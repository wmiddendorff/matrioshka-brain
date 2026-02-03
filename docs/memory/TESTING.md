# Memory System - Testing Strategy

## Test Coverage

- **Location**: `tests/memory.test.ts`
- **Framework**: Vitest
- **Current status**: 33 tests, all passing
- **Integration test**: `tests/integration-memory.mjs` (manual, real embeddings)
- **Performance test**: `tests/perf-10k.mjs` (standalone, 10K entries, fake embeddings)

## Test Strategy

### Unit Tests (`tests/memory.test.ts`)

Tests use an **in-memory SQLite database** with the full schema (including sqlite-vec and FTS5) to avoid filesystem side effects. Fake embeddings (deterministic pseudo-random 384-dim vectors) are used instead of the real model to keep tests fast (<100ms total).

### Integration Test (`tests/integration-memory.mjs`)

A standalone Node.js script that loads the real all-MiniLM-L6-v2 model and exercises the full flow: add entries, deduplicate, search (vector/keyword/hybrid), access logging, stats, delete, and bulk performance.

Run manually:

```bash
node tests/integration-memory.mjs
```

## Current Test Suite

### Types (2 tests)

**rowToEntry converts database row correctly**
- Verifies all fields map from snake_case DB columns to camelCase TS properties
- Confirms JSON tags are parsed to arrays

**rowToEntry handles null optional fields**
- Verifies `null` context/tags/expiresAt/lastAccessedAt become `undefined` or `[]`

### Content Hash (2 tests)

**generates consistent SHA-256 hash**
- Same content produces same hash
- Hash is 64 hex characters

**generates different hashes for different content**
- Different content produces different hashes

### Database CRUD (5 tests)

**adds an entry with defaults**
- Inserts entry, confirms `created: true, duplicate: false`

**adds an entry with all fields**
- Inserts with entryType, source, context, confidence, importance, tags, expiresAt
- Retrieves and verifies all fields persisted correctly

**deduplicates by content hash**
- Adds same content twice
- Second add returns `created: false, duplicate: true` with original ID

**gets an entry by ID**
- Retrieves inserted entry, confirms content matches

**returns null for non-existent entry**
- `getEntry(999)` returns `null`

**deletes an entry**
- Deletes entry, confirms `true` returned
- Subsequent get returns `null`

**returns false when deleting non-existent entry**
- `deleteEntry(999)` returns `false`

### Access Logging (2 tests)

**logs access and increments count**
- Initial access_count is 0
- After logAccess: count is 1, lastAccessedAt is set
- After second logAccess: count is 2

**creates access log entries**
- Two accesses create two rows in memory_access_log
- Verifies access_type, relevance_score, query_text stored correctly

### Vector Search (3 tests)

**finds similar entries by embedding**
- Inserts 3 entries with different embeddings
- Searching with entry 1's embedding returns entry 1 as closest (distance ~0)

**respects limit**
- Inserts 5 entries, searches with limit 2, gets 2 results

**returns empty for empty database**
- Search on empty DB returns `[]`

### Keyword Search (5 tests)

**finds entries by keyword**
- Inserts 3 entries, searches "dark" finds entries containing "dark"

**searches context and tags too**
- Entry with context "programming session" found by searching "programming"

**returns empty for no matches**
- Non-existent word returns no results

**handles empty query gracefully**
- Empty string returns `[]`

**handles special characters in query**
- Queries with quotes/parens are sanitized and still return results

### Memory Stats (4 tests)

**returns zeros for empty database**
- All counts 0, averages 0, timestamps null

**returns accurate counts by type**
- 4 entries across 3 types: correct byType breakdown

**computes averages correctly**
- Two entries with importance 3 and 7: avg = 5
- Two entries with confidence 0.6 and 0.8: avg = 0.7

**tracks access counts in stats**
- Two accesses logged: totalAccesses = 2

### FTS Sync Triggers (2 tests)

**FTS index is updated on insert**
- Insert entry, keyword search finds it

**FTS index is cleaned up on delete**
- Insert, verify searchable, delete, verify gone from FTS

### Configurable Hybrid Weights (3 tests)

**hybridSearch uses default weights when none provided**
- Verifies SearchOptions accepts vectorWeight and keywordWeight fields

**SearchOptions type accepts weight fields**
- Compile-time and runtime verification of new type fields

**different weights produce different scores in hybrid mode**
- Verifies that changing weights produces different combined scores

### Performance (1 test)

**search 10,000 entries in under 500ms**
- Bulk inserts 10,000 entries with fake embeddings in a transaction
- Benchmarks vector search, keyword search, and hybrid search
- All searches verified under 500ms
- Test completes in ~420ms

### Embedding Module (2 tests)

**getEmbeddingDimensions returns 384**

**isModelLoaded returns boolean**

## Test Isolation

Each test group uses `beforeEach` to create a fresh in-memory database and `afterEach` to close it. This ensures:

- No state leaks between tests
- No filesystem side effects
- Tests can run in parallel
- No dependency on model download (fake embeddings)

```typescript
let db: Database.Database;

beforeEach(() => {
  db = createTestDb(); // in-memory with full schema
});

afterEach(() => {
  db.close();
});
```

## Manual Testing Checklist

### Full Flow

- [x] Add a memory with all metadata
- [x] Add duplicate content, get `duplicate: true`
- [x] Vector search returns semantically similar results
- [x] Keyword search finds exact word matches
- [x] Hybrid search combines both
- [x] Get entry by ID, access count increments
- [x] Stats reflect correct counts and averages
- [x] Delete removes from entries, FTS, and vec_entries
- [x] Search after delete returns no ghost results

### Performance

- [x] Model loads in <2s
- [x] Bulk insert 50 entries in <1s
- [x] Vector search <500ms at 57 entries
- [x] Vector search <500ms at 10,000 entries (4ms P50)
- [x] Keyword search <500ms at 10,000 entries (1ms)
- [x] Hybrid search <500ms at 10,000 entries (4ms P50)

### Edge Cases

- [x] Empty database returns sensible defaults
- [x] Non-existent entry ID returns null/error
- [x] Special characters in search query handled
- [x] Empty search query returns empty results
- [ ] Very long content (>10KB)
- [ ] Unicode content
- [ ] Expired entries filtered from search

## Running Tests

```bash
# Run all tests (unit)
npm test

# Run memory tests only
npx vitest run tests/memory.test.ts

# Watch mode
npx vitest tests/memory.test.ts

# Integration test (requires model download on first run)
node tests/integration-memory.mjs

# Coverage
npm run test:coverage

# Performance test (10K entries, standalone)
node tests/perf-10k.mjs
```

## Performance Test (`tests/perf-10k.mjs`)

Standalone script that:
1. Creates an in-memory SQLite database with full schema
2. Inserts 10,000 entries with fake embeddings (deterministic, fast)
3. Runs 10 search queries (3 vector, 3 keyword, 4 hybrid)
4. Reports P50, P95, and max latency
5. Asserts all searches complete in <500ms

Results on Linux:
- Insert: 10K entries in ~412ms (0.04ms/entry)
- P50: 3ms, P95: 4ms, Max: 4ms

## Future Test Coverage

### Missing Unit Tests

1. Expired entry filtering in search results
2. Tag-based filtering in hybrid search
3. minImportance / minConfidence filtering
4. Multiple search modes (vector-only, keyword-only)
5. Score normalization edge cases (single result, all same distance)
6. Daily log file creation and content format
7. File indexer with mock filesystem
8. Indexer debounce behavior
9. Indexer content hash deduplication

### Performance Tests

1. ~~Insert 10,000 entries, measure search latency~~ ✅ Done
2. Concurrent read/write operations
3. Memory usage with large entry count

### Integration Tests

1. MCP tool round-trip (via tool registry)
2. Config-driven behavior (enabled/disabled, search mode)
3. Database persistence across restarts
4. Daily log creation via memory_add tool
5. File indexer end-to-end (modify file → verify in search)
