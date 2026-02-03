/**
 * File Auto-Indexer
 *
 * Watches the workspace directory for .md file changes and automatically
 * indexes their content into the memory database. Uses fs.watch with
 * debouncing and content hash tracking to detect actual changes.
 */

import { watch, readFileSync, readdirSync, statSync, existsSync, type FSWatcher } from 'fs';
import { join, relative, extname } from 'path';
import { createHash } from 'crypto';
import { resolvePath } from '../config.js';

const WORKSPACE_DIR = 'workspace';
const MAX_FILE_SIZE = 100 * 1024; // 100KB
const DEBOUNCE_MS = 500;

/** Track content hashes to detect actual changes */
const fileHashes = new Map<string, string>();

/** Debounce timers per file */
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Active watcher instance */
let watcher: FSWatcher | null = null;

/** Polling interval ID (fallback) */
let pollIntervalId: ReturnType<typeof setInterval> | null = null;

/** Whether the indexer is running */
let running = false;

/**
 * Compute a hash of file content for change detection.
 */
function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Index a single .md file into memory.
 * Returns true if the file was indexed (new or changed), false if unchanged.
 */
async function indexFile(filePath: string): Promise<boolean> {
  try {
    const stat = statSync(filePath);
    if (stat.size > MAX_FILE_SIZE) return false;
    if (stat.size === 0) return false;

    const content = readFileSync(filePath, 'utf-8');
    const contentHash = hashContent(content);

    // Check if content has actually changed
    if (fileHashes.get(filePath) === contentHash) {
      return false;
    }

    fileHashes.set(filePath, contentHash);

    // Import memory functions lazily to avoid circular deps
    const { getMemoryDb, addEntry } = await import('./db.js');
    const { generateEmbedding } = await import('./embeddings.js');

    const db = getMemoryDb();
    const workspaceDir = resolvePath(WORKSPACE_DIR);
    const relativePath = relative(workspaceDir, filePath);
    const embedding = await generateEmbedding(content);

    addEntry(db, {
      content,
      entryType: 'fact',
      source: 'file-index',
      context: `Indexed from ${relativePath}`,
      tags: [relativePath],
    }, embedding);

    return true;
  } catch {
    // File may have been deleted between detection and read
    return false;
  }
}

/**
 * Scan a directory recursively for .md files.
 */
function scanDirectory(dir: string): string[] {
  const files: string[] = [];

  if (!existsSync(dir)) return files;

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...scanDirectory(fullPath));
      } else if (entry.isFile() && extname(entry.name) === '.md') {
        files.push(fullPath);
      }
    }
  } catch {
    // Permission errors or deleted directories
  }

  return files;
}

/**
 * Handle a file change event with debouncing.
 */
function handleFileChange(filePath: string): void {
  if (extname(filePath) !== '.md') return;

  // Clear existing debounce timer for this file
  const existing = debounceTimers.get(filePath);
  if (existing) clearTimeout(existing);

  // Set new debounce timer
  debounceTimers.set(filePath, setTimeout(async () => {
    debounceTimers.delete(filePath);
    if (!existsSync(filePath)) return;
    await indexFile(filePath);
  }, DEBOUNCE_MS));
}

/**
 * Perform an initial scan of all .md files in the workspace.
 */
export async function initialScan(): Promise<number> {
  const workspaceDir = resolvePath(WORKSPACE_DIR);
  const files = scanDirectory(workspaceDir);
  let indexed = 0;

  for (const file of files) {
    const wasIndexed = await indexFile(file);
    if (wasIndexed) indexed++;
  }

  return indexed;
}

/**
 * Start the file indexer.
 *
 * Tries fs.watch first (efficient, event-based). Falls back to interval
 * polling if fs.watch is not available or fails.
 *
 * @param options.interval - Polling interval in ms (fallback mode only, default: 5000)
 * @param options.skipInitialScan - Skip the initial scan on startup (for testing)
 */
export async function startIndexer(options?: {
  interval?: number;
  skipInitialScan?: boolean;
}): Promise<void> {
  if (running) return;
  running = true;

  const workspaceDir = resolvePath(WORKSPACE_DIR);

  if (!existsSync(workspaceDir)) {
    console.error(`Indexer: workspace directory does not exist: ${workspaceDir}`);
    running = false;
    return;
  }

  // Initial scan
  if (!options?.skipInitialScan) {
    const count = await initialScan();
    if (count > 0) {
      console.error(`Indexer: initial scan indexed ${count} files`);
    }
  }

  // Try fs.watch with recursive option
  try {
    watcher = watch(workspaceDir, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      const fullPath = join(workspaceDir, filename);
      handleFileChange(fullPath);
    });

    watcher.on('error', (err) => {
      console.error(`Indexer: fs.watch error, falling back to polling:`, err.message);
      watcher?.close();
      watcher = null;
      startPolling(workspaceDir, options?.interval ?? 5000);
    });
  } catch {
    // fs.watch not available, use polling
    startPolling(workspaceDir, options?.interval ?? 5000);
  }
}

/**
 * Start polling-based file watching (fallback).
 */
function startPolling(workspaceDir: string, interval: number): void {
  pollIntervalId = setInterval(async () => {
    const files = scanDirectory(workspaceDir);
    for (const file of files) {
      await indexFile(file);
    }
  }, interval);
}

/**
 * Stop the file indexer.
 */
export function stopIndexer(): void {
  running = false;

  if (watcher) {
    watcher.close();
    watcher = null;
  }

  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }

  // Clear debounce timers
  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  debounceTimers.clear();
}

/**
 * Check if the indexer is running.
 */
export function isIndexerRunning(): boolean {
  return running;
}

/**
 * Reset the content hash cache (for testing).
 */
export function _resetIndexerCache(): void {
  fileHashes.clear();
}
