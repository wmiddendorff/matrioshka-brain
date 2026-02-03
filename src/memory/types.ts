/**
 * Memory Module Types
 *
 * Type definitions for the memory persistence system.
 */

/** Valid entry types for memory entries */
export type EntryType = 'fact' | 'preference' | 'event' | 'insight' | 'task' | 'relationship';

/** Valid search modes */
export type SearchMode = 'hybrid' | 'vector' | 'keyword';

/** A memory entry stored in the database */
export interface MemoryEntry {
  id: number;
  content: string;
  contentHash: string;
  entryType: EntryType;
  source: string;
  context?: string;
  confidence: number;
  importance: number;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  accessCount: number;
  lastAccessedAt?: number;
}

/** Input for creating a new memory entry */
export interface MemoryInput {
  content: string;
  entryType?: EntryType;
  source?: string;
  context?: string;
  confidence?: number;
  importance?: number;
  tags?: string[];
  expiresAt?: number;
}

/** A search result with relevance score */
export interface SearchResult {
  entry: MemoryEntry;
  score: number;
  /** Which search method contributed to this result */
  matchedBy: ('vector' | 'keyword')[];
}

/** Options for searching memories */
export interface SearchOptions {
  query: string;
  mode?: SearchMode;
  limit?: number;
  entryTypes?: EntryType[];
  minImportance?: number;
  minConfidence?: number;
  tags?: string[];
  /** Weight for vector search scores in hybrid mode (0-1, default: 0.7) */
  vectorWeight?: number;
  /** Weight for keyword search scores in hybrid mode (0-1, default: 0.3) */
  keywordWeight?: number;
}

/** Result from adding a memory */
export interface AddResult {
  id: number;
  created: boolean;
  duplicate: boolean;
}

/** Memory statistics */
export interface MemoryStats {
  totalEntries: number;
  byType: Record<string, number>;
  avgImportance: number;
  avgConfidence: number;
  totalAccesses: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

/** Raw database row for a memory entry */
export interface MemoryRow {
  id: number;
  content: string;
  content_hash: string;
  entry_type: string;
  source: string;
  context: string | null;
  confidence: number;
  importance: number;
  tags: string | null;
  created_at: number;
  updated_at: number;
  expires_at: number | null;
  access_count: number;
  last_accessed_at: number | null;
}

/** Convert a database row to a MemoryEntry */
export function rowToEntry(row: MemoryRow): MemoryEntry {
  return {
    id: row.id,
    content: row.content,
    contentHash: row.content_hash,
    entryType: row.entry_type as EntryType,
    source: row.source,
    context: row.context ?? undefined,
    confidence: row.confidence,
    importance: row.importance,
    tags: row.tags ? JSON.parse(row.tags) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at ?? undefined,
    accessCount: row.access_count,
    lastAccessedAt: row.last_accessed_at ?? undefined,
  };
}
