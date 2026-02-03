# Memory API Reference

## MCP Tools

### `memory_add`

Create a new memory entry with automatic embedding generation and deduplication.

**Input:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `content` | string | yes | - | The memory text (min 1 char) |
| `entryType` | string | no | `"fact"` | One of: fact, preference, event, insight, task, relationship |
| `source` | string | no | `"manual"` | Where the memory came from |
| `context` | string | no | - | Additional context |
| `confidence` | number | no | 1.0 | Confidence level (0.0 - 1.0) |
| `importance` | number | no | 5 | Importance level (1 - 10) |
| `tags` | string[] | no | - | Tags for categorization |
| `expiresAt` | number | no | - | Unix timestamp for expiration |

**Output:**

```json
{ "id": 1, "created": true, "duplicate": false }
```

If the same content already exists:

```json
{ "id": 1, "created": false, "duplicate": true }
```

**Side effects:**
- On successful creation (when `source` is not `'file-index'`), appends a timestamped entry to the daily log at `~/.mudpuppy/workspace/memory/YYYY-MM-DD.md`

**Example:**

```json
{
  "content": "User prefers dark mode for all applications",
  "entryType": "preference",
  "importance": 7,
  "tags": ["ui", "theme"]
}
```

---

### `memory_search`

Search memories using hybrid, vector, or keyword search.

**Input:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | yes | - | Search query text |
| `mode` | string | no | `"hybrid"` | Search mode: hybrid, vector, or keyword |
| `limit` | number | no | 10 | Max results to return |
| `entryTypes` | string[] | no | - | Filter by entry types |
| `minImportance` | number | no | - | Minimum importance (1-10) |
| `minConfidence` | number | no | - | Minimum confidence (0-1) |
| `tags` | string[] | no | - | Filter by tags (any match) |

**Output:**

```json
{
  "results": [
    {
      "id": 1,
      "content": "User prefers dark mode for all applications",
      "entryType": "preference",
      "source": "manual",
      "context": null,
      "confidence": 1.0,
      "importance": 7,
      "tags": ["ui", "theme"],
      "score": 0.85,
      "matchedBy": ["vector", "keyword"],
      "createdAt": 1738540800000
    }
  ],
  "total": 1
}
```

**Examples:**

```json
// Hybrid search (default)
{ "query": "UI preferences" }

// Vector-only (semantic)
{ "query": "what theme does the user like", "mode": "vector" }

// Keyword-only (exact match)
{ "query": "dark mode", "mode": "keyword" }

// Filtered search
{
  "query": "user preferences",
  "entryTypes": ["preference"],
  "minImportance": 5,
  "limit": 3
}
```

---

### `memory_get`

Get a memory entry by ID. Logs the access for analytics and increments the access count.

**Input:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | yes | Memory entry ID |

**Output:**

```json
{
  "entry": {
    "id": 1,
    "content": "User prefers dark mode for all applications",
    "contentHash": "a1b2c3...",
    "entryType": "preference",
    "source": "manual",
    "context": null,
    "confidence": 1.0,
    "importance": 7,
    "tags": ["ui", "theme"],
    "createdAt": 1738540800000,
    "updatedAt": 1738540800000,
    "expiresAt": null,
    "accessCount": 1,
    "lastAccessedAt": 1738540900000
  }
}
```

If not found:

```json
{ "error": "Memory entry not found: 99" }
```

---

### `memory_stats`

Get statistics about stored memories.

**Input:** None (empty object `{}`)

**Output:**

```json
{
  "totalEntries": 8,
  "byType": {
    "fact": 2,
    "preference": 2,
    "event": 1,
    "insight": 2,
    "task": 1
  },
  "avgImportance": 6.5,
  "avgConfidence": 1.0,
  "totalAccesses": 3,
  "oldestEntry": 1738540800000,
  "newestEntry": 1738540900000
}
```

---

### `memory_delete`

Delete a memory entry by ID. Removes the entry, its embedding vector, and FTS index.

**Input:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | yes | Memory entry ID to delete |

**Output:**

```json
{ "success": true, "deleted": true }
```

If entry does not exist:

```json
{ "success": false, "deleted": false }
```

---

## Programmatic API

### Database

#### `getMemoryDb(): Database`

Get or create the singleton memory database instance. Creates the schema on first call.

```typescript
import { getMemoryDb } from 'mudpuppy';
const db = getMemoryDb();
```

#### `closeMemoryDb(): void`

Close the database connection. Used for cleanup in tests.

#### `contentHash(content: string): string`

Generate SHA-256 hash of content for deduplication.

```typescript
import { contentHash } from 'mudpuppy';
const hash = contentHash('hello world');
// '7509e5bda...' (64 char hex string)
```

### CRUD Operations

#### `addEntry(db, input, embedding): AddResult`

Add a memory entry with its embedding vector.

```typescript
import { getMemoryDb, addEntry, generateEmbedding } from 'mudpuppy';

const db = getMemoryDb();
const embedding = await generateEmbedding('User prefers dark mode');
const result = addEntry(db, {
  content: 'User prefers dark mode',
  entryType: 'preference',
  importance: 7,
}, embedding);
// { id: 1, created: true, duplicate: false }
```

#### `getEntry(db, id): MemoryEntry | null`

Get a memory entry by ID. Returns `null` if not found.

#### `deleteEntry(db, id): boolean`

Delete a memory entry. Returns `true` if deleted, `false` if not found.

#### `logAccess(db, memoryId, accessType, relevanceScore?, queryText?): void`

Log an access to a memory entry and increment its access count.

```typescript
import { getMemoryDb, logAccess } from 'mudpuppy';
logAccess(getMemoryDb(), 1, 'search', 0.85, 'UI preferences');
```

#### `getStats(db): MemoryStats`

Get memory statistics.

### Search

#### `vectorSearch(db, embedding, limit): { entryId, distance }[]`

Low-level vector similarity search via sqlite-vec.

#### `keywordSearch(db, query, limit): { entryId, rank }[]`

Low-level FTS5 keyword search with BM25 ranking.

#### `hybridSearch(db, options): Promise<SearchResult[]>`

High-level hybrid search combining vector and keyword results. Supports configurable weights.

```typescript
import { getMemoryDb, hybridSearch } from 'mudpuppy';

const results = await hybridSearch(getMemoryDb(), {
  query: 'UI preferences',
  mode: 'hybrid',
  limit: 5,
  entryTypes: ['preference'],
  minImportance: 3,
  vectorWeight: 0.5,  // optional, default: 0.7
  keywordWeight: 0.5, // optional, default: 0.3
});
```

When called via the `memory_search` MCP tool, weights are read from `config.memory.hybridWeights`.

### Embeddings

#### `generateEmbedding(text): Promise<Float32Array>`

Generate a 384-dimensional embedding vector. Lazy-loads the model on first call.

#### `getEmbeddingDimensions(): number`

Returns `384` (all-MiniLM-L6-v2 dimensions).

#### `isModelLoaded(): boolean`

Check if the embedding model is loaded in memory.

#### `preloadModel(): Promise<void>`

Preload the embedding model to avoid latency on first search.

### Daily Log

#### `ensureDailyLog(date?): string`

Ensure today's daily log file exists. Creates the directory and file with a markdown header if they don't exist. Returns the file path. Caches the date to avoid repeated filesystem checks.

```typescript
import { ensureDailyLog } from 'mudpuppy';
const logPath = ensureDailyLog(); // ~/.mudpuppy/workspace/memory/2026-02-03.md
```

#### `appendToDailyLog(content, entryType, source): void`

Append a timestamped entry to today's daily log.

```typescript
import { appendToDailyLog } from 'mudpuppy';
appendToDailyLog('User prefers dark mode', 'preference', 'manual');
// Appends: "- **14:30:00** [preference] (manual) User prefers dark mode"
```

#### `getDailyLogPath(date?): string`

Get the path to a daily log file. Defaults to today.

### File Indexer

#### `startIndexer(options?): Promise<void>`

Start the file auto-indexer. Watches `~/.mudpuppy/workspace/` for `.md` file changes.

```typescript
import { startIndexer } from 'mudpuppy';
await startIndexer({ interval: 5000 }); // polling interval (fallback)
```

Options:
- `interval`: Polling interval in ms for fallback mode (default: 5000)
- `skipInitialScan`: Skip the initial scan on startup

#### `stopIndexer(): void`

Stop the file indexer and clean up watchers/timers.

#### `isIndexerRunning(): boolean`

Check if the indexer is currently running.

#### `initialScan(): Promise<number>`

Manually trigger a scan of all `.md` files in the workspace. Returns the number of files indexed.

---

## TypeScript Types

```typescript
type EntryType = 'fact' | 'preference' | 'event' | 'insight' | 'task' | 'relationship';
type SearchMode = 'hybrid' | 'vector' | 'keyword';

interface MemoryEntry {
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

interface MemoryInput {
  content: string;
  entryType?: EntryType;
  source?: string;
  context?: string;
  confidence?: number;
  importance?: number;
  tags?: string[];
  expiresAt?: number;
}

interface SearchResult {
  entry: MemoryEntry;
  score: number;
  matchedBy: ('vector' | 'keyword')[];
}

interface SearchOptions {
  query: string;
  mode?: SearchMode;
  limit?: number;
  entryTypes?: EntryType[];
  minImportance?: number;
  minConfidence?: number;
  tags?: string[];
  vectorWeight?: number;  // 0-1, default: 0.7
  keywordWeight?: number; // 0-1, default: 0.3
}

interface AddResult {
  id: number;
  created: boolean;
  duplicate: boolean;
}

interface MemoryStats {
  totalEntries: number;
  byType: Record<string, number>;
  avgImportance: number;
  avgConfidence: number;
  totalAccesses: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}
```
