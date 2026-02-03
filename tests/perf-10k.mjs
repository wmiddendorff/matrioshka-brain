/**
 * Performance test: 10,000 entries with search latency measurement.
 *
 * Uses fake (deterministic) embeddings for fast insertion - this tests
 * SQLite + sqlite-vec + FTS5 query performance, not embedding generation.
 *
 * Run: node tests/perf-10k.mjs
 *
 * Success criteria: All search queries complete in <500ms.
 */

import { createRequire } from 'module';
import Database from 'better-sqlite3';
import { createHash } from 'crypto';

const require = createRequire(import.meta.url);

// -- Helpers --

function hash(content) {
  return createHash('sha256').update(content).digest('hex');
}

function ok(label) { console.log('  OK: ' + label); }
function fail(label, err) { console.error('  FAIL: ' + label + ': ' + err); process.exitCode = 1; }
function section(s) { console.log('\n== ' + s + ' =='); }

/**
 * Generate a deterministic fake 384-dimensional embedding.
 * Fast: no model needed, purely algorithmic.
 */
function fakeEmbedding(seed) {
  const arr = new Float32Array(384);
  let s = seed + 1;
  for (let i = 0; i < 384; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    arr[i] = (s / 0x7fffffff) * 2 - 1;
  }
  // Normalize
  let norm = 0;
  for (let i = 0; i < 384; i++) norm += arr[i] * arr[i];
  norm = Math.sqrt(norm);
  for (let i = 0; i < 384; i++) arr[i] /= norm;
  return arr;
}

// -- Setup --

section('Setup: Create in-memory DB with sqlite-vec + FTS5');

const db = new Database(':memory:');
db.pragma('journal_mode = WAL');

const sqliteVec = require('sqlite-vec');
sqliteVec.load(db);
ok('sqlite-vec loaded');

db.exec(`
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
  CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_entries(entry_type);
  CREATE INDEX IF NOT EXISTS idx_memory_importance ON memory_entries(importance DESC);
  CREATE INDEX IF NOT EXISTS idx_memory_hash ON memory_entries(content_hash);
  CREATE INDEX IF NOT EXISTS idx_memory_expires ON memory_entries(expires_at);
`);

db.exec(`CREATE VIRTUAL TABLE memory_fts USING fts5(content, context, tags, content='memory_entries', content_rowid='id');`);

db.exec(`
  CREATE TRIGGER IF NOT EXISTS memory_ai AFTER INSERT ON memory_entries BEGIN
    INSERT INTO memory_fts(rowid, content, context, tags) VALUES (new.id, new.content, new.context, new.tags);
  END;
  CREATE TRIGGER IF NOT EXISTS memory_ad AFTER DELETE ON memory_entries BEGIN
    INSERT INTO memory_fts(memory_fts, rowid, content, context, tags) VALUES('delete', old.id, old.content, old.context, old.tags);
  END;
  CREATE TRIGGER IF NOT EXISTS memory_au AFTER UPDATE ON memory_entries BEGIN
    INSERT INTO memory_fts(memory_fts, rowid, content, context, tags) VALUES('delete', old.id, old.content, old.context, old.tags);
    INSERT INTO memory_fts(rowid, content, context, tags) VALUES (new.id, new.content, new.context, new.tags);
  END;
`);

db.exec(`CREATE VIRTUAL TABLE vec_entries USING vec0(entry_id INTEGER PRIMARY KEY, embedding float[384]);`);
ok('Schema created');

// -- Insert 10,000 entries --

section('Insert 10,000 entries with fake embeddings');

const TOTAL = 10000;
const topics = [
  'TypeScript', 'Rust', 'Python', 'Go', 'Java', 'C++', 'Kotlin', 'Swift', 'Ruby', 'Elixir',
  'web development', 'systems programming', 'data science', 'cloud computing', 'mobile apps',
  'machine learning', 'database design', 'API architecture', 'security', 'DevOps',
];
const adjectives = [
  'efficient', 'powerful', 'flexible', 'modern', 'scalable',
  'robust', 'elegant', 'fast', 'reliable', 'simple',
];
const verbs = [
  'builds', 'creates', 'optimizes', 'manages', 'processes',
  'transforms', 'analyzes', 'deploys', 'monitors', 'tests',
];

const insertStmt = db.prepare(
  'INSERT INTO memory_entries (content, content_hash, entry_type, source, confidence, importance, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
const vecStmt = db.prepare(
  'INSERT INTO vec_entries (entry_id, embedding) VALUES (?, ?)'
);

const entryTypes = ['fact', 'preference', 'event', 'insight', 'task', 'relationship'];

const insertStart = Date.now();

const insertMany = db.transaction(() => {
  for (let i = 0; i < TOTAL; i++) {
    const topic = topics[i % topics.length];
    const adj = adjectives[i % adjectives.length];
    const verb = verbs[i % verbs.length];
    const content = `Entry ${i}: ${topic} ${verb} ${adj} solutions for modern software engineering (variant ${Math.floor(i / 100)})`;
    const h = hash(content);
    const now = Date.now();
    const entryType = entryTypes[i % entryTypes.length];
    const importance = (i % 10) + 1;
    const tags = JSON.stringify([topic.toLowerCase().replace(/\s+/g, '-'), 'perf-test']);

    const result = insertStmt.run(content, h, entryType, 'perf-test', 1.0, importance, tags, now, now);
    const id = Number(result.lastInsertRowid);
    const emb = fakeEmbedding(i);
    vecStmt.run(BigInt(id), Buffer.from(emb.buffer));
  }
});

insertMany();

const insertTime = Date.now() - insertStart;
const count = db.prepare('SELECT COUNT(*) as c FROM memory_entries').get().c;
ok(`Inserted ${count} entries in ${insertTime}ms (${(insertTime / TOTAL).toFixed(2)}ms/entry)`);

// -- Search benchmarks --

section('Search benchmarks (10 queries)');

const queries = [
  { label: 'Vector: TypeScript solutions', type: 'vector', seed: 42 },
  { label: 'Vector: Python data science', type: 'vector', seed: 123 },
  { label: 'Vector: Rust systems', type: 'vector', seed: 7 },
  { label: 'Keyword: TypeScript', type: 'keyword', query: 'TypeScript' },
  { label: 'Keyword: machine learning', type: 'keyword', query: 'machine learning' },
  { label: 'Keyword: database design', type: 'keyword', query: 'database design' },
  { label: 'Hybrid: Go cloud computing', type: 'hybrid', seed: 55, query: 'Go cloud computing' },
  { label: 'Hybrid: security testing', type: 'hybrid', seed: 88, query: 'security testing' },
  { label: 'Hybrid: API architecture', type: 'hybrid', seed: 99, query: 'API architecture' },
  { label: 'Hybrid: DevOps deployment', type: 'hybrid', seed: 200, query: 'DevOps deployment' },
];

const VEC_WEIGHT = 0.7, KW_WEIGHT = 0.3;
const latencies = [];

for (const q of queries) {
  const start = Date.now();
  const limit = 10;
  const pool = limit * 3;

  let results = [];

  if (q.type === 'vector' || q.type === 'hybrid') {
    const qEmb = fakeEmbedding(q.seed);
    const vecHits = db.prepare('SELECT entry_id, distance FROM vec_entries WHERE embedding MATCH ? ORDER BY distance LIMIT ?')
      .all(Buffer.from(qEmb.buffer), pool);

    if (q.type === 'vector') {
      results = vecHits.map(r => ({ entryId: r.entry_id, distance: r.distance }));
    } else {
      // Hybrid: combine with keyword
      const vecMap = new Map();
      if (vecHits.length > 0) {
        const maxDist = Math.max(...vecHits.map(h => h.distance), 0.001);
        for (const h of vecHits) {
          const sim = 1 - h.distance / Math.max(maxDist * 2, 2);
          vecMap.set(h.entry_id, Math.max(0, Math.min(1, sim)));
        }
      }

      const safe = q.query.replace(/['"(){}[\]:^~*]/g, ' ').trim();
      const kwHits = safe
        ? db.prepare('SELECT rowid as entry_id, rank FROM memory_fts WHERE memory_fts MATCH ? ORDER BY rank LIMIT ?').all(safe, pool)
        : [];
      const kwMap = new Map();
      if (kwHits.length > 0) {
        const ranks = kwHits.map(h => h.rank);
        const minR = Math.min(...ranks), maxR = Math.max(...ranks);
        const range = maxR - minR || 1;
        for (const kh of kwHits) {
          kwMap.set(kh.entry_id, Math.max(0, Math.min(1, (maxR - kh.rank) / range)));
        }
      }

      const allIds = new Set([...vecMap.keys(), ...kwMap.keys()]);
      const scored = [];
      for (const id of allIds) {
        let score = 0;
        if (vecMap.has(id)) score += vecMap.get(id) * VEC_WEIGHT;
        if (kwMap.has(id)) score += kwMap.get(id) * KW_WEIGHT;
        scored.push({ entryId: id, score });
      }
      scored.sort((a, b) => b.score - a.score);
      results = scored.slice(0, limit);
    }
  } else {
    // Keyword only
    const safe = q.query.replace(/['"(){}[\]:^~*]/g, ' ').trim();
    if (safe) {
      results = db.prepare('SELECT rowid as entry_id, rank FROM memory_fts WHERE memory_fts MATCH ? ORDER BY rank LIMIT ?').all(safe, limit);
    }
  }

  const elapsed = Date.now() - start;
  latencies.push(elapsed);
  console.log(`  ${q.label}: ${elapsed}ms (${results.length} results)`);
}

// -- Report --

section('Latency Report');

latencies.sort((a, b) => a - b);
const p50 = latencies[Math.floor(latencies.length * 0.5)];
const p95 = latencies[Math.floor(latencies.length * 0.95)];
const max = latencies[latencies.length - 1];

console.log(`  P50: ${p50}ms`);
console.log(`  P95: ${p95}ms`);
console.log(`  Max: ${max}ms`);

if (max < 500) {
  ok(`All searches under 500ms (max: ${max}ms)`);
} else {
  fail('Performance', `max search time ${max}ms exceeds 500ms target`);
}

// -- Summary --

section('Summary');
console.log(`  Entries: ${count}`);
console.log(`  Insert time: ${insertTime}ms`);
console.log(`  P50 search: ${p50}ms`);
console.log(`  P95 search: ${p95}ms`);
console.log(`  Max search: ${max}ms`);

db.close();
console.log('\nDone.');
