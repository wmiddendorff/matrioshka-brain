/**
 * Memory Search Module
 *
 * Hybrid search combining vector similarity (sqlite-vec) and
 * keyword matching (FTS5 BM25). Default weights: 0.7 vector + 0.3 keyword.
 */

import type Database from 'better-sqlite3';
import type { SearchOptions, SearchResult, MemoryRow, EntryType } from './types.js';
import { rowToEntry } from './types.js';
import { generateEmbedding } from './embeddings.js';
import { vectorSearch as dbVectorSearch, keywordSearch as dbKeywordSearch } from './db.js';

/** Default hybrid search weights */
const DEFAULT_VECTOR_WEIGHT = 0.7;
const DEFAULT_KEYWORD_WEIGHT = 0.3;

/** Internal search pool size (fetch more, then filter/limit) */
const SEARCH_POOL_MULTIPLIER = 3;

/**
 * Perform a hybrid search combining vector and keyword results.
 */
export async function hybridSearch(
  db: Database.Database,
  options: SearchOptions
): Promise<SearchResult[]> {
  const mode = options.mode ?? 'hybrid';
  const limit = options.limit ?? 10;
  const poolSize = limit * SEARCH_POOL_MULTIPLIER;

  let vectorResults: Map<number, number> = new Map();
  let keywordResults: Map<number, number> = new Map();

  // Vector search
  if (mode === 'vector' || mode === 'hybrid') {
    const embedding = await generateEmbedding(options.query);
    const vecHits = dbVectorSearch(db, embedding, poolSize);

    if (vecHits.length > 0) {
      // Normalize distances to [0, 1] similarity scores
      // sqlite-vec returns cosine distance (0 = identical, 2 = opposite)
      // Convert to similarity: 1 - (distance / 2)
      const maxDist = Math.max(...vecHits.map((h) => h.distance), 0.001);
      for (const hit of vecHits) {
        const similarity = 1 - hit.distance / Math.max(maxDist * 2, 2);
        vectorResults.set(hit.entryId, Math.max(0, Math.min(1, similarity)));
      }
    }
  }

  // Keyword search
  if (mode === 'keyword' || mode === 'hybrid') {
    const kwHits = dbKeywordSearch(db, options.query, poolSize);

    if (kwHits.length > 0) {
      // Normalize BM25 ranks to [0, 1] scores
      // FTS5 rank is negative (more negative = better match)
      const ranks = kwHits.map((h) => h.rank);
      const minRank = Math.min(...ranks); // Most negative = best
      const maxRank = Math.max(...ranks); // Least negative = worst
      const range = maxRank - minRank || 1;

      for (const hit of kwHits) {
        // Invert: best rank (most negative) gets highest score
        const normalized = (maxRank - hit.rank) / range;
        keywordResults.set(hit.entryId, Math.max(0, Math.min(1, normalized)));
      }
    }
  }

  // Combine scores
  const allIds = new Set([...vectorResults.keys(), ...keywordResults.keys()]);
  const scored: { entryId: number; score: number; matchedBy: ('vector' | 'keyword')[] }[] = [];

  for (const id of allIds) {
    const vecScore = vectorResults.get(id);
    const kwScore = keywordResults.get(id);
    const matchedBy: ('vector' | 'keyword')[] = [];

    let score = 0;
    if (mode === 'hybrid') {
      if (vecScore !== undefined) {
        score += vecScore * (options.vectorWeight ?? DEFAULT_VECTOR_WEIGHT);
        matchedBy.push('vector');
      }
      if (kwScore !== undefined) {
        score += kwScore * (options.keywordWeight ?? DEFAULT_KEYWORD_WEIGHT);
        matchedBy.push('keyword');
      }
    } else if (mode === 'vector') {
      score = vecScore ?? 0;
      if (vecScore !== undefined) matchedBy.push('vector');
    } else {
      score = kwScore ?? 0;
      if (kwScore !== undefined) matchedBy.push('keyword');
    }

    scored.push({ entryId: id, score, matchedBy });
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Fetch full entries and apply filters
  const results: SearchResult[] = [];
  for (const item of scored) {
    if (results.length >= limit) break;

    const row = db.prepare('SELECT * FROM memory_entries WHERE id = ?').get(item.entryId) as MemoryRow | undefined;
    if (!row) continue;

    // Apply filters
    if (options.entryTypes && options.entryTypes.length > 0) {
      if (!options.entryTypes.includes(row.entry_type as EntryType)) continue;
    }

    if (options.minImportance !== undefined && row.importance < options.minImportance) continue;
    if (options.minConfidence !== undefined && row.confidence < options.minConfidence) continue;

    if (options.tags && options.tags.length > 0) {
      const entryTags: string[] = row.tags ? JSON.parse(row.tags) : [];
      const hasMatchingTag = options.tags.some((t) => entryTags.includes(t));
      if (!hasMatchingTag) continue;
    }

    // Skip expired entries
    if (row.expires_at && row.expires_at < Date.now()) continue;

    results.push({
      entry: rowToEntry(row),
      score: item.score,
      matchedBy: item.matchedBy,
    });
  }

  return results;
}
