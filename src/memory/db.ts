/**
 * Memory Database Module
 *
 * SQLite database initialization, schema management, and CRUD operations
 * for the memory persistence system. Uses sqlite-vec for vector search
 * and FTS5 for keyword search.
 */

import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { createRequire } from 'module';
import { dirname } from 'path';
import { resolvePath } from '../config.js';
import type { MemoryEntry, MemoryInput, MemoryRow, AddResult, MemoryStats } from './types.js';
import { rowToEntry } from './types.js';

const require = createRequire(import.meta.url);

const DB_PATH = 'data/memory.db';

/** Singleton database instance */
let dbInstance: Database.Database | null = null;

/**
 * Generate SHA-256 content hash for deduplication.
 */
export function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Get or create the memory database instance.
 */
export function getMemoryDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbPath = resolvePath(DB_PATH);
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);

  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');

  // Load sqlite-vec extension
  loadVecExtension(db);

  // Create schema
  initSchema(db);

  dbInstance = db;
  return db;
}

/**
 * Load the sqlite-vec extension into the database.
 */
function loadVecExtension(db: Database.Database): void {
  const sqliteVec = require('sqlite-vec');
  sqliteVec.load(db);
}

/**
 * Initialize the database schema.
 */
function initSchema(db: Database.Database): void {
  db.exec(`
    -- Main entries table
    CREATE TABLE IF NOT EXISTS memory_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      content_hash TEXT UNIQUE NOT NULL,
      entry_type TEXT NOT NULL DEFAULT 'fact',
      source TEXT DEFAULT 'manual',
      context TEXT,
      confidence REAL DEFAULT 1.0,
      importance INTEGER DEFAULT 5,
      tags TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      expires_at INTEGER,
      access_count INTEGER DEFAULT 0,
      last_accessed_at INTEGER
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_entries(entry_type);
    CREATE INDEX IF NOT EXISTS idx_memory_importance ON memory_entries(importance DESC);
    CREATE INDEX IF NOT EXISTS idx_memory_hash ON memory_entries(content_hash);
    CREATE INDEX IF NOT EXISTS idx_memory_expires ON memory_entries(expires_at);

    -- Access log for analytics
    CREATE TABLE IF NOT EXISTS memory_access_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      memory_id INTEGER NOT NULL,
      accessed_at INTEGER NOT NULL,
      access_type TEXT NOT NULL,
      relevance_score REAL,
      query_text TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_access_memory ON memory_access_log(memory_id);
  `);

  // FTS5 virtual table for keyword search (created separately since IF NOT EXISTS
  // behaves differently for virtual tables)
  try {
    db.exec(`
      CREATE VIRTUAL TABLE memory_fts USING fts5(
        content, context, tags,
        content='memory_entries', content_rowid='id'
      );
    `);
  } catch {
    // Table already exists - this is expected
  }

  // FTS sync triggers
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS memory_ai AFTER INSERT ON memory_entries BEGIN
      INSERT INTO memory_fts(rowid, content, context, tags)
      VALUES (new.id, new.content, new.context, new.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS memory_ad AFTER DELETE ON memory_entries BEGIN
      INSERT INTO memory_fts(memory_fts, rowid, content, context, tags)
      VALUES('delete', old.id, old.content, old.context, old.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS memory_au AFTER UPDATE ON memory_entries BEGIN
      INSERT INTO memory_fts(memory_fts, rowid, content, context, tags)
      VALUES('delete', old.id, old.content, old.context, old.tags);
      INSERT INTO memory_fts(rowid, content, context, tags)
      VALUES (new.id, new.content, new.context, new.tags);
    END;
  `);

  // sqlite-vec virtual table for vector search (384 dimensions for all-MiniLM-L6-v2)
  try {
    db.exec(`
      CREATE VIRTUAL TABLE vec_entries USING vec0(
        entry_id INTEGER PRIMARY KEY,
        embedding float[384]
      );
    `);
  } catch {
    // Table already exists - this is expected
  }
}

/**
 * Add a memory entry to the database.
 * Returns the entry ID and whether it was a duplicate.
 */
export function addEntry(
  db: Database.Database,
  input: MemoryInput,
  embedding: Float32Array
): AddResult {
  const hash = contentHash(input.content);
  const now = Date.now();

  // Check for duplicate
  const existing = db.prepare(
    'SELECT id FROM memory_entries WHERE content_hash = ?'
  ).get(hash) as { id: number } | undefined;

  if (existing) {
    return { id: existing.id, created: false, duplicate: true };
  }

  const tagsJson = input.tags && input.tags.length > 0
    ? JSON.stringify(input.tags)
    : null;

  // Insert the entry
  const result = db.prepare(`
    INSERT INTO memory_entries (
      content, content_hash, entry_type, source, context,
      confidence, importance, tags, created_at, updated_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.content,
    hash,
    input.entryType ?? 'fact',
    input.source ?? 'manual',
    input.context ?? null,
    input.confidence ?? 1.0,
    input.importance ?? 5,
    tagsJson,
    now,
    now,
    input.expiresAt ?? null
  );

  const entryId = Number(result.lastInsertRowid);

  // Insert embedding into vec_entries (sqlite-vec requires BigInt for primary keys)
  db.prepare(
    'INSERT INTO vec_entries (entry_id, embedding) VALUES (?, ?)'
  ).run(BigInt(entryId), Buffer.from(embedding.buffer));

  return { id: entryId, created: true, duplicate: false };
}

/**
 * Get a memory entry by ID.
 */
export function getEntry(db: Database.Database, id: number): MemoryEntry | null {
  const row = db.prepare(
    'SELECT * FROM memory_entries WHERE id = ?'
  ).get(id) as MemoryRow | undefined;

  if (!row) return null;
  return rowToEntry(row);
}

/**
 * Delete a memory entry by ID.
 */
export function deleteEntry(db: Database.Database, id: number): boolean {
  // Delete from vec_entries first (sqlite-vec requires BigInt for primary keys)
  db.prepare('DELETE FROM vec_entries WHERE entry_id = ?').run(BigInt(id));

  // Delete from main table (triggers handle FTS cleanup)
  const result = db.prepare('DELETE FROM memory_entries WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Log an access to a memory entry and increment its access count.
 */
export function logAccess(
  db: Database.Database,
  memoryId: number,
  accessType: string,
  relevanceScore?: number,
  queryText?: string
): void {
  const now = Date.now();

  db.prepare(`
    INSERT INTO memory_access_log (memory_id, accessed_at, access_type, relevance_score, query_text)
    VALUES (?, ?, ?, ?, ?)
  `).run(memoryId, now, accessType, relevanceScore ?? null, queryText ?? null);

  db.prepare(`
    UPDATE memory_entries SET access_count = access_count + 1, last_accessed_at = ? WHERE id = ?
  `).run(now, memoryId);
}

/**
 * Perform a vector similarity search using sqlite-vec.
 * Returns entry IDs with their distance scores.
 */
export function vectorSearch(
  db: Database.Database,
  embedding: Float32Array,
  limit: number
): { entryId: number; distance: number }[] {
  const rows = db.prepare(`
    SELECT entry_id, distance
    FROM vec_entries
    WHERE embedding MATCH ?
    ORDER BY distance
    LIMIT ?
  `).all(Buffer.from(embedding.buffer), limit) as { entry_id: number; distance: number }[];

  return rows.map((row) => ({
    entryId: row.entry_id,
    distance: row.distance,
  }));
}

/**
 * Perform a keyword search using FTS5 with BM25 scoring.
 * Returns entry IDs with their BM25 rank scores.
 */
export function keywordSearch(
  db: Database.Database,
  query: string,
  limit: number
): { entryId: number; rank: number }[] {
  // Escape FTS5 special characters for safe querying
  const safeQuery = query.replace(/['"(){}[\]:^~*]/g, ' ').trim();
  if (!safeQuery) return [];

  const rows = db.prepare(`
    SELECT rowid as entry_id, rank
    FROM memory_fts
    WHERE memory_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `).all(safeQuery, limit) as { entry_id: number; rank: number }[];

  return rows.map((row) => ({
    entryId: row.entry_id,
    rank: row.rank,
  }));
}

/**
 * Get memory statistics.
 */
export function getStats(db: Database.Database): MemoryStats {
  const total = db.prepare(
    'SELECT COUNT(*) as count FROM memory_entries'
  ).get() as { count: number };

  const byTypeRows = db.prepare(
    'SELECT entry_type, COUNT(*) as count FROM memory_entries GROUP BY entry_type'
  ).all() as { entry_type: string; count: number }[];

  const byType: Record<string, number> = {};
  for (const row of byTypeRows) {
    byType[row.entry_type] = row.count;
  }

  const avgImportance = db.prepare(
    'SELECT AVG(importance) as avg FROM memory_entries'
  ).get() as { avg: number | null };

  const avgConfidence = db.prepare(
    'SELECT AVG(confidence) as avg FROM memory_entries'
  ).get() as { avg: number | null };

  const totalAccesses = db.prepare(
    'SELECT SUM(access_count) as total FROM memory_entries'
  ).get() as { total: number | null };

  const oldest = db.prepare(
    'SELECT MIN(created_at) as ts FROM memory_entries'
  ).get() as { ts: number | null };

  const newest = db.prepare(
    'SELECT MAX(created_at) as ts FROM memory_entries'
  ).get() as { ts: number | null };

  return {
    totalEntries: total.count,
    byType,
    avgImportance: avgImportance.avg ?? 0,
    avgConfidence: avgConfidence.avg ?? 0,
    totalAccesses: totalAccesses.total ?? 0,
    oldestEntry: oldest.ts,
    newestEntry: newest.ts,
  };
}

/**
 * Close the database connection. Used for testing cleanup.
 */
export function closeMemoryDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Create a memory database from an existing Database instance.
 * Used for testing with in-memory databases.
 */
export function initMemoryDbFrom(db: Database.Database): void {
  loadVecExtension(db);
  initSchema(db);
  dbInstance = db;
}
