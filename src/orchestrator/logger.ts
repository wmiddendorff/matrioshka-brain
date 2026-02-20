/**
 * Orchestrator Logger
 *
 * JSONL session logging with automatic rotation.
 */

import { appendFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { resolvePath } from '../config.js';
import type { OrchestratorLogEntry } from './types.js';

const LOG_DIR = 'logs/orchestrator';

function getLogDir(): string {
  const dir = resolvePath(LOG_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getLogPath(date?: Date): string {
  const d = date ?? new Date();
  const ymd = d.toISOString().slice(0, 10);
  return join(getLogDir(), `${ymd}.jsonl`);
}

/**
 * Append an entry to today's log file.
 */
export function logEntry(entry: OrchestratorLogEntry): void {
  const logPath = getLogPath();
  appendFileSync(logPath, JSON.stringify(entry) + '\n');
}

/**
 * Read recent log entries (from today's file by default).
 */
export function readRecentLogs(maxEntries = 20): OrchestratorLogEntry[] {
  const logPath = getLogPath();
  if (!existsSync(logPath)) return [];

  try {
    const content = readFileSync(logPath, 'utf-8').trim();
    if (!content) return [];

    const lines = content.split('\n');
    const entries: OrchestratorLogEntry[] = [];

    // Read from end for most recent
    for (let i = lines.length - 1; i >= 0 && entries.length < maxEntries; i--) {
      try {
        entries.push(JSON.parse(lines[i]) as OrchestratorLogEntry);
      } catch {
        // skip malformed lines
      }
    }

    return entries;
  } catch {
    return [];
  }
}

/**
 * Get the last log entry.
 */
export function getLastEntry(): OrchestratorLogEntry | null {
  const entries = readRecentLogs(1);
  return entries[0] ?? null;
}

/**
 * Rotate old log files, keeping only the last N days.
 */
export function rotateLogs(retentionDays = 30): number {
  const dir = getLogDir();
  if (!existsSync(dir)) return 0;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  let removed = 0;

  try {
    const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
    for (const file of files) {
      const dateStr = basename(file, '.jsonl');
      if (dateStr < cutoffStr) {
        try {
          unlinkSync(join(dir, file));
          removed++;
        } catch {
          // skip
        }
      }
    }
  } catch {
    // skip
  }

  return removed;
}
