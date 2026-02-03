/**
 * Manual integration test for memory tools with real embeddings.
 * Exercises: add (with dedup) -> search (hybrid/vector/keyword) -> get -> stats -> delete
 *
 * Run: node tests/integration-memory.mjs
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

// -- Setup --

section('Setup: Load sqlite-vec + create in-memory DB');

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
  CREATE INDEX IF NOT EXISTS idx_memory_hash ON memory_entries(content_hash);

  CREATE TABLE IF NOT EXISTS memory_access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memory_id INTEGER NOT NULL,
    accessed_at INTEGER NOT NULL,
    access_type TEXT NOT NULL,
    relevance_score REAL,
    query_text TEXT
  );
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

// -- Load real embeddings model --

section('Load embedding model (all-MiniLM-L6-v2)');

console.log('  Loading @xenova/transformers pipeline...');
const startLoad = Date.now();

const { pipeline } = await import('@xenova/transformers');
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true });

const loadTime = Date.now() - startLoad;
ok('Model loaded in ' + loadTime + 'ms');

async function embed(text) {
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return new Float32Array(output.data);
}

const testEmb = await embed('hello world');
if (testEmb.length === 384) ok('Embedding dimensions: ' + testEmb.length);
else fail('Embedding dimensions', 'expected 384, got ' + testEmb.length);

// -- Add entries --

section('memory_add: Insert entries');

const entries = [
  { content: 'User prefers dark mode for all applications', entryType: 'preference', importance: 7, tags: ['ui', 'theme'] },
  { content: 'Meeting with design team scheduled for Friday at 3pm', entryType: 'event', importance: 8, tags: ['calendar', 'meeting'] },
  { content: 'TypeScript is a typed superset of JavaScript', entryType: 'fact', importance: 5 },
  { content: 'The user dislikes excessive notifications', entryType: 'preference', importance: 6, tags: ['ui', 'notifications'] },
  { content: 'Project deadline is end of February 2026', entryType: 'task', importance: 9, tags: ['deadline', 'project'] },
  { content: 'SQLite supports full-text search via FTS5', entryType: 'insight', importance: 6, tags: ['database', 'search'] },
  { content: 'User lives in the Pacific timezone', entryType: 'fact', importance: 4 },
  { content: 'Always use meaningful variable names in code reviews', entryType: 'insight', importance: 7, tags: ['coding', 'review'] },
];

const ids = [];
for (const e of entries) {
  const emb = await embed(e.content);
  const h = hash(e.content);
  const now = Date.now();
  const tagsJson = e.tags ? JSON.stringify(e.tags) : null;

  const result = db.prepare(
    'INSERT INTO memory_entries (content, content_hash, entry_type, source, context, confidence, importance, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(e.content, h, e.entryType, 'manual', null, 1.0, e.importance, tagsJson, now, now);

  const id = Number(result.lastInsertRowid);
  db.prepare('INSERT INTO vec_entries (entry_id, embedding) VALUES (?, ?)').run(BigInt(id), Buffer.from(emb.buffer));
  ids.push(id);
}
ok('Inserted ' + ids.length + ' entries (IDs: ' + ids.join(', ') + ')');

// -- Deduplication --

section('memory_add: Deduplication');

const dupHash = hash('User prefers dark mode for all applications');
const existing = db.prepare('SELECT id FROM memory_entries WHERE content_hash = ?').get(dupHash);
if (existing) {
  ok('Duplicate detected, existing ID: ' + existing.id + ', no new row created');
} else {
  fail('Deduplication', 'should have found existing entry');
}

// -- Vector search --

section('memory_search: Vector (semantic) search');

async function vecSearch(query, limit) {
  limit = limit || 5;
  const qEmb = await embed(query);
  const rows = db.prepare('SELECT entry_id, distance FROM vec_entries WHERE embedding MATCH ? ORDER BY distance LIMIT ?')
    .all(Buffer.from(qEmb.buffer), limit);
  return rows.map(function(r) { return { entryId: r.entry_id, distance: r.distance }; });
}

const vecResults = await vecSearch('dark theme preference');
console.log('  Query: "dark theme preference"');
for (const r of vecResults) {
  const row = db.prepare('SELECT content FROM memory_entries WHERE id = ?').get(r.entryId);
  console.log('    #' + r.entryId + ' (dist=' + r.distance.toFixed(4) + '): ' + row.content.substring(0, 70));
}
if (vecResults[0] && vecResults[0].entryId === ids[0]) {
  ok('Top result is "User prefers dark mode" -- semantically correct');
} else {
  fail('Vector search', 'expected ID ' + ids[0] + ' at top, got ' + (vecResults[0] && vecResults[0].entryId));
}

const vecResults2 = await vecSearch('when is the project due');
console.log('  Query: "when is the project due"');
for (const r of vecResults2) {
  const row = db.prepare('SELECT content FROM memory_entries WHERE id = ?').get(r.entryId);
  console.log('    #' + r.entryId + ' (dist=' + r.distance.toFixed(4) + '): ' + row.content.substring(0, 70));
}
const top2due = vecResults2.slice(0, 2).map(function(r) { return r.entryId; });
if (top2due.includes(ids[4])) {
  ok('Project deadline in top 2 -- semantically correct');
} else {
  fail('Vector search for deadline', 'expected ID ' + ids[4] + ' near top');
}

// -- Keyword search --

section('memory_search: Keyword (FTS5) search');

function kwSearch(query, limit) {
  limit = limit || 5;
  var safe = query.replace(/['"(){}[\]:^~*]/g, ' ').trim();
  if (!safe) return [];
  return db.prepare('SELECT rowid as entry_id, rank FROM memory_fts WHERE memory_fts MATCH ? ORDER BY rank LIMIT ?')
    .all(safe, limit)
    .map(function(r) { return { entryId: r.entry_id, rank: r.rank }; });
}

const kwResults = kwSearch('dark mode');
console.log('  Query: "dark mode"');
for (const r of kwResults) {
  const row = db.prepare('SELECT content FROM memory_entries WHERE id = ?').get(r.entryId);
  console.log('    #' + r.entryId + ' (rank=' + r.rank.toFixed(4) + '): ' + row.content.substring(0, 70));
}
if (kwResults.some(function(r) { return r.entryId === ids[0]; })) {
  ok('"User prefers dark mode" found via keyword search');
} else {
  fail('Keyword search', 'dark mode entry not found');
}

const kwResults2 = kwSearch('TypeScript JavaScript');
console.log('  Query: "TypeScript JavaScript"');
for (const r of kwResults2) {
  const row = db.prepare('SELECT content FROM memory_entries WHERE id = ?').get(r.entryId);
  console.log('    #' + r.entryId + ' (rank=' + r.rank.toFixed(4) + '): ' + row.content.substring(0, 70));
}
if (kwResults2.some(function(r) { return r.entryId === ids[2]; })) {
  ok('"TypeScript is a typed superset" found via keyword search');
} else {
  fail('Keyword search', 'TypeScript entry not found');
}

// -- Hybrid search --

section('memory_search: Hybrid (vector + keyword) search');

async function hybridSearch(query, limit) {
  limit = limit || 5;
  var VEC_WEIGHT = 0.7, KW_WEIGHT = 0.3;
  var pool = limit * 3;

  var qEmb = await embed(query);
  var vecHits = db.prepare('SELECT entry_id, distance FROM vec_entries WHERE embedding MATCH ? ORDER BY distance LIMIT ?')
    .all(Buffer.from(qEmb.buffer), pool);
  var vecMap = new Map();
  if (vecHits.length > 0) {
    var maxDist = Math.max.apply(null, vecHits.map(function(h) { return h.distance; }).concat([0.001]));
    for (var h of vecHits) {
      var sim = 1 - h.distance / Math.max(maxDist * 2, 2);
      vecMap.set(h.entry_id, Math.max(0, Math.min(1, sim)));
    }
  }

  var kwHits = kwSearch(query, pool);
  var kwMap = new Map();
  if (kwHits.length > 0) {
    var ranks = kwHits.map(function(h) { return h.rank; });
    var minR = Math.min.apply(null, ranks), maxR = Math.max.apply(null, ranks);
    var range = maxR - minR || 1;
    for (var kh of kwHits) {
      kwMap.set(kh.entryId, Math.max(0, Math.min(1, (maxR - kh.rank) / range)));
    }
  }

  var allIds = new Set([...vecMap.keys(), ...kwMap.keys()]);
  var scored = [];
  for (var id of allIds) {
    var score = 0;
    var matchedBy = [];
    if (vecMap.has(id)) { score += vecMap.get(id) * VEC_WEIGHT; matchedBy.push('vector'); }
    if (kwMap.has(id)) { score += kwMap.get(id) * KW_WEIGHT; matchedBy.push('keyword'); }
    scored.push({ entryId: id, score: score, matchedBy: matchedBy });
  }
  scored.sort(function(a, b) { return b.score - a.score; });
  return scored.slice(0, limit);
}

const hybridResults = await hybridSearch('notifications and UI preferences');
console.log('  Query: "notifications and UI preferences"');
for (const r of hybridResults) {
  const row = db.prepare('SELECT content FROM memory_entries WHERE id = ?').get(r.entryId);
  console.log('    #' + r.entryId + ' (score=' + r.score.toFixed(4) + ', via=' + r.matchedBy.join('+') + '): ' + row.content.substring(0, 70));
}
var notifIdx = hybridResults.findIndex(function(r) { return r.entryId === ids[3]; });
if (notifIdx >= 0 && notifIdx <= 2) ok('"dislikes excessive notifications" in top 3');
else fail('Hybrid search', 'notifications entry at position ' + notifIdx);

// -- memory_get: Access logging --

section('memory_get: Fetch + access logging');

var entryBefore = db.prepare('SELECT access_count FROM memory_entries WHERE id = ?').get(ids[0]);
console.log('  Access count before: ' + entryBefore.access_count);

var nowTs = Date.now();
db.prepare('INSERT INTO memory_access_log (memory_id, accessed_at, access_type) VALUES (?, ?, ?)').run(ids[0], nowTs, 'get');
db.prepare('UPDATE memory_entries SET access_count = access_count + 1, last_accessed_at = ? WHERE id = ?').run(nowTs, ids[0]);

var entryAfter = db.prepare('SELECT access_count, last_accessed_at FROM memory_entries WHERE id = ?').get(ids[0]);
console.log('  Access count after:  ' + entryAfter.access_count);
if (entryAfter.access_count === (entryBefore.access_count + 1)) ok('Access count incremented');
else fail('Access logging', 'count not incremented');

// -- memory_stats --

section('memory_stats');

var total = db.prepare('SELECT COUNT(*) as c FROM memory_entries').get().c;
var byType = db.prepare('SELECT entry_type, COUNT(*) as c FROM memory_entries GROUP BY entry_type').all();
var avgImp = db.prepare('SELECT AVG(importance) as a FROM memory_entries').get().a;

console.log('  Total entries: ' + total);
console.log('  By type: ' + byType.map(function(r) { return r.entry_type + '=' + r.c; }).join(', '));
console.log('  Avg importance: ' + avgImp.toFixed(2));

if (total === 8) ok('Total entries correct (8)');
else fail('Stats', 'expected 8 entries, got ' + total);

// -- memory_delete --

section('memory_delete');

var deleteId = ids[6];
db.prepare('DELETE FROM vec_entries WHERE entry_id = ?').run(BigInt(deleteId));
var delResult = db.prepare('DELETE FROM memory_entries WHERE id = ?').run(deleteId);
if (delResult.changes === 1) ok('Deleted entry #' + deleteId);
else fail('Delete', 'no rows deleted');

var ftsCheck = db.prepare('SELECT rowid FROM memory_fts WHERE memory_fts MATCH ?').all('Pacific timezone');
if (ftsCheck.length === 0) ok('Entry removed from FTS index');
else fail('Delete FTS cleanup', 'entry still in FTS');

var newTotal = db.prepare('SELECT COUNT(*) as c FROM memory_entries').get().c;
if (newTotal === 7) ok('Total entries now: ' + newTotal);
else fail('Post-delete count', 'expected 7, got ' + newTotal);

// -- Search after delete --

section('Search after delete (verify no ghosts)');

var postDeleteVec = await vecSearch('Pacific timezone');
var ghostFound = postDeleteVec.some(function(r) { return r.entryId === deleteId; });
if (!ghostFound) ok('Deleted entry not returned by vector search');
else fail('Post-delete vector search', 'ghost entry found');

var postDeleteKw = kwSearch('Pacific timezone');
var kwGhostFound = postDeleteKw.some(function(r) { return r.entryId === deleteId; });
if (!kwGhostFound) ok('Deleted entry not returned by keyword search');
else fail('Post-delete keyword search', 'ghost entry found');

// -- Performance --

section('Performance: Bulk embed + insert timing');

var bulkCount = 50;
var bulkContents = [];
var langs = ['TypeScript', 'Rust', 'Python', 'Go', 'Java'];
var domains = ['web', 'systems', 'data', 'cloud', 'enterprise'];
for (var i = 0; i < bulkCount; i++) {
  bulkContents.push('Performance test entry ' + i + ': ' + langs[i % 5] + ' is great for ' + domains[i % 5] + ' development');
}

var bulkStart = Date.now();
for (var c of bulkContents) {
  var emb = await embed(c);
  var h = hash(c);
  var n = Date.now();
  var r = db.prepare('INSERT INTO memory_entries (content, content_hash, entry_type, source, confidence, importance, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(c, h, 'fact', 'perf-test', 1.0, 5, null, n, n);
  db.prepare('INSERT INTO vec_entries (entry_id, embedding) VALUES (?, ?)').run(BigInt(Number(r.lastInsertRowid)), Buffer.from(emb.buffer));
}
var bulkTime = Date.now() - bulkStart;
ok('Inserted ' + bulkCount + ' entries in ' + bulkTime + 'ms (' + (bulkTime / bulkCount).toFixed(1) + 'ms/entry)');

var searchStart = Date.now();
await vecSearch('Rust systems programming', 10);
var searchTime = Date.now() - searchStart;
ok('Vector search (' + (7 + bulkCount) + ' entries) in ' + searchTime + 'ms');
if (searchTime < 500) ok('Search time under 500ms target');
else console.log('  WARNING: Search took ' + searchTime + 'ms (target: <500ms)');

// -- Summary --

section('Summary');
console.log('  Model load time: ' + loadTime + 'ms');
console.log('  Bulk insert: ' + bulkCount + ' entries in ' + bulkTime + 'ms');
console.log('  Search latency: ' + searchTime + 'ms');
console.log('  Final entry count: ' + db.prepare('SELECT COUNT(*) as c FROM memory_entries').get().c);

db.close();
console.log('\nDone.');
