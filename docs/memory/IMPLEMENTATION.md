# Memory System - Implementation Details

## Architecture

```
┌──────────────────┐      ┌──────────────────────────────────────────┐
│  MCP Tools       │      │  SQLite (data/memory.db)                 │
│  memory_add      │─────>│  ┌──────────────┐  ┌───────────────┐    │
│  memory_search   │      │  │memory_entries │  │ memory_fts    │    │
│  memory_get      │      │  │(main table)   │  │ (FTS5 keyword)│    │
│  memory_stats    │      │  └──────────────┘  └───────────────┘    │
│  memory_delete   │      │  ┌──────────────┐  ┌───────────────┐    │
└──────────────────┘      │  │ vec_entries   │  │ access_log    │    │
       │                  │  │ (sqlite-vec)  │  │ (analytics)   │    │
       v                  │  └──────────────┘  └───────────────┘    │
┌──────────────────┐      └──────────────────────────────────────────┘
│  Embeddings      │
│  @xenova/         │
│  transformers     │
│  all-MiniLM-L6-v2│
└──────────────────┘
```

## File Layout

```
src/memory/
├── index.ts          # Module re-exports
├── types.ts          # Interfaces: MemoryEntry, SearchResult, etc.
├── db.ts             # SQLite schema, CRUD, vector/keyword search primitives
├── embeddings.ts     # Lazy-loaded transformer pipeline
├── search.ts         # Hybrid search algorithm
├── daily-log.ts      # Daily markdown log file creation and appending
└── indexer.ts         # File auto-indexer (fs.watch + polling fallback)

src/tools/
└── memory.ts         # 5 MCP tool registrations
```

## Database Schema

### `memory_entries` (main table)

```sql
CREATE TABLE memory_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  content_hash TEXT UNIQUE NOT NULL,    -- SHA-256 for dedup
  entry_type TEXT NOT NULL DEFAULT 'fact',
  source TEXT DEFAULT 'manual',
  context TEXT,
  confidence REAL DEFAULT 1.0,          -- 0.0 to 1.0
  importance INTEGER DEFAULT 5,         -- 1 to 10
  tags TEXT,                            -- JSON array or NULL
  created_at INTEGER NOT NULL,          -- Unix ms
  updated_at INTEGER NOT NULL,
  expires_at INTEGER,                   -- Optional expiration
  access_count INTEGER DEFAULT 0,
  last_accessed_at INTEGER
);
```

Indexed on: `entry_type`, `importance DESC`, `content_hash`, `expires_at`.

### `memory_fts` (FTS5 virtual table)

```sql
CREATE VIRTUAL TABLE memory_fts USING fts5(
  content, context, tags,
  content='memory_entries', content_rowid='id'
);
```

Content-sync table backed by `memory_entries`. Kept in sync via three triggers:
- `memory_ai` (AFTER INSERT)
- `memory_ad` (AFTER DELETE)
- `memory_au` (AFTER UPDATE)

### `vec_entries` (sqlite-vec virtual table)

```sql
CREATE VIRTUAL TABLE vec_entries USING vec0(
  entry_id INTEGER PRIMARY KEY,
  embedding float[384]
);
```

384 dimensions matching all-MiniLM-L6-v2 output.

### `memory_access_log`

```sql
CREATE TABLE memory_access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memory_id INTEGER NOT NULL,
  accessed_at INTEGER NOT NULL,
  access_type TEXT NOT NULL,      -- 'get', 'search', etc.
  relevance_score REAL,
  query_text TEXT
);
```

Indexed on `memory_id`.

## Design Decisions

### Why SQLite + Extensions Over a Dedicated Vector DB?

- **Single dependency**: One SQLite file stores everything (entries, FTS, vectors, logs)
- **No running service**: No need to run a separate vector DB process
- **Atomic operations**: Entries, FTS, and vectors stay in sync via triggers
- **Portable**: Copy one `.db` file to move all memory
- **Trade-off**: Less optimized for very large datasets (100k+), but sufficient for personal agent use

### Why Local Embeddings Over API-Based?

- **Privacy**: No data leaves the machine
- **No API costs**: Zero marginal cost per embedding
- **Offline capable**: Works without internet
- **Consistent**: Same model always produces same embeddings
- **Trade-off**: ~80MB model download on first use, slightly lower quality than large API models

### Why Hybrid Search?

Neither vector nor keyword search alone is sufficient:

- **Vector search** understands semantics ("dark theme" finds "user prefers dark mode") but misses exact terms
- **Keyword search** finds exact matches fast but misses semantic similarity ("UI preferences" won't find "dark mode")
- **Hybrid** combines both: 0.7 * vector_score + 0.3 * keyword_score

The 0.7/0.3 split was chosen because semantic understanding is more valuable than exact matching for a memory system, but exact matches should still boost results.

### Why SHA-256 Content Hash for Deduplication?

- UNIQUE constraint on `content_hash` prevents duplicates at the database level
- SHA-256 is collision-resistant (no false dedup)
- Fast: hashing is <1ms even for large content
- Alternative considered: embedding similarity threshold (rejected: too slow, false positives)

### Why Lazy Model Loading?

The all-MiniLM-L6-v2 model is ~80MB. Loading it takes ~1.4s. If memory tools are never used in a session, this cost is avoided entirely. The pipeline is cached after first load, so subsequent embeddings are fast (~4.7ms each).

### Why BigInt for sqlite-vec Primary Keys?

sqlite-vec requires integer primary keys to be passed as JavaScript `BigInt`, not `Number`. This is a quirk of the native extension. Using `Number` throws: "Only integers are allowed for primary key values."

## Hybrid Search Algorithm

```
hybridSearch(query, options):
  1. Generate embedding for query text
  2. Vector search: query vec_entries with MATCH, get top N*3 results
  3. Keyword search: query memory_fts with MATCH, get top N*3 results
  4. Normalize vector distances to [0,1] similarity scores
     - similarity = 1 - (distance / max(maxDistance*2, 2))
  5. Normalize FTS5 BM25 ranks to [0,1] scores
     - score = (maxRank - rank) / range  (inverted: more negative = better)
  6. Combine: score = vectorWeight * vectorScore + keywordWeight * keywordScore
     (defaults: vectorWeight=0.7, keywordWeight=0.3; configurable via SearchOptions or config)
  7. Sort by combined score descending
  8. Fetch full entries, apply filters (entryTypes, minImportance, etc.)
  9. Skip expired entries
  10. Return top N results
```

The pool multiplier (3x) ensures enough candidates survive filtering.

## Embedding Pipeline

The embedding module uses `@xenova/transformers` (transformers.js) with:

- **Model**: `Xenova/all-MiniLM-L6-v2` (quantized ONNX)
- **Pooling**: Mean pooling across tokens
- **Normalization**: L2-normalized output vectors
- **Dimensions**: 384

The pipeline is created via dynamic `import()` to avoid loading the library until needed.

## Data Flow: Adding a Memory

```
1. MCP tool receives input (content, metadata)
2. Generate SHA-256 content hash
3. Check for duplicate (SELECT by content_hash)
4. If duplicate: return existing ID
5. Generate embedding via transformers.js
6. INSERT into memory_entries (triggers sync to memory_fts)
7. INSERT into vec_entries (BigInt primary key)
8. If created && source !== 'file-index': append to daily log
9. Return { id, created: true, duplicate: false }
```

The `source !== 'file-index'` check in step 8 prevents a feedback loop: the auto-indexer indexes daily log files, which would otherwise trigger more daily log entries.

## Data Flow: Deleting a Memory

```
1. DELETE from vec_entries WHERE entry_id = BigInt(id)
2. DELETE from memory_entries WHERE id = ?
   → Trigger memory_ad fires: removes from memory_fts
3. Return whether any row was deleted
```

Order matters: vec_entries first (no trigger), then memory_entries (triggers FTS cleanup).

## Performance Characteristics

Measured on Linux with 10,000 entries (fake embeddings for insert, real search):

| Operation | Latency |
|-----------|---------|
| Model load (first use) | ~1,400ms |
| Single embedding | ~4.7ms |
| Bulk insert 10K entries | ~412ms (0.04ms/entry) |
| Vector search (10K entries) | ~4ms P50 |
| Keyword search (10K entries) | ~1ms |
| Hybrid search (10K entries) | ~4ms P50, ~4ms P95 |
| Max search latency (10K) | 4ms (target: <500ms) |

## Error Handling

- **Model load failure**: Error propagated to MCP tool response
- **Database locked**: WAL mode minimizes contention
- **Duplicate content**: Returns existing entry (not an error)
- **Invalid entry type**: Zod schema validation rejects at tool input layer
- **Missing entry**: Returns `null` / error message (not an exception)
- **FTS query syntax errors**: Special characters stripped before querying

## Daily Log Module (`daily-log.ts`)

Creates and appends to daily markdown log files at `~/.mudpuppy/workspace/memory/YYYY-MM-DD.md`.

- `ensureDailyLog()`: Creates directory and file with markdown header if needed
- `appendToDailyLog(content, entryType, source)`: Appends timestamped line
- Caches `lastLogDate` to avoid repeated filesystem checks within the same day
- Content truncated to 200 chars in the log line
- Called automatically by `memory_add` tool (when `source !== 'file-index'`)

## File Auto-Indexer (`indexer.ts`)

Watches `~/.mudpuppy/workspace/` for `.md` file changes and indexes their content.

**Architecture:**
- Primary: `fs.watch` with `recursive: true` (event-based, efficient)
- Fallback: `setInterval` polling if `fs.watch` fails
- Content hash tracking (`Map<filePath, SHA-256>`) to detect actual changes
- 500ms debounce per file to handle rapid saves
- Initial scan on startup indexes all existing `.md` files
- Files >100KB are skipped
- Indexed entries use `source: 'file-index'`, `entryType: 'fact'`, filename in tags

**Feedback loop prevention:**
The daily log module skips appending when `source === 'file-index'`, so auto-indexed files don't create daily log entries that would then be re-indexed.

**Integration:**
Started in `mcp-server.ts` after `initTools()` when `config.memory.autoIndex === true`.

## Future Improvements

1. Batch embedding generation for bulk imports
2. Memory expiration cleanup job (cron-based)
3. Memory compaction/summarization for old entries
4. Cross-session memory sharing
5. Embedding model selection via config
6. Incremental file indexing (track file offsets for appended content)
