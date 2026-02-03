/**
 * Memory Module
 *
 * Hybrid search memory persistence system using SQLite + sqlite-vec + FTS5.
 */

// Types
export type {
  EntryType,
  SearchMode,
  MemoryEntry,
  MemoryInput,
  SearchResult,
  SearchOptions,
  AddResult,
  MemoryStats,
} from './types.js';
export { rowToEntry } from './types.js';

// Database operations
export {
  getMemoryDb,
  closeMemoryDb,
  contentHash,
  addEntry,
  getEntry,
  deleteEntry,
  logAccess,
  vectorSearch,
  keywordSearch,
  getStats,
} from './db.js';

// Search
export { hybridSearch } from './search.js';

// Embeddings
export {
  generateEmbedding,
  getEmbeddingDimensions,
  isModelLoaded,
  preloadModel,
} from './embeddings.js';

// Daily log
export {
  ensureDailyLog,
  appendToDailyLog,
  getDailyLogPath,
} from './daily-log.js';

// File indexer
export {
  startIndexer,
  stopIndexer,
  isIndexerRunning,
  initialScan,
} from './indexer.js';
