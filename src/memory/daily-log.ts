/**
 * Daily Log Module
 *
 * Creates and appends to daily markdown log files in the workspace/memory/ directory.
 * Each day gets its own file: YYYY-MM-DD.md
 */

import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import { resolvePath } from '../config.js';

const MEMORY_DIR = 'workspace/memory';

/** Track the last date we verified the log file exists */
let lastLogDate: string | null = null;

/**
 * Get today's date as YYYY-MM-DD string.
 */
function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get the path to today's daily log file.
 */
export function getDailyLogPath(date?: string): string {
  const dateStr = date ?? todayString();
  return resolvePath(join(MEMORY_DIR, `${dateStr}.md`));
}

/**
 * Ensure today's daily log file exists. Creates the directory and file
 * with a markdown header if they don't exist. Skips filesystem checks
 * if we already verified for today's date.
 */
export function ensureDailyLog(date?: string): string {
  const dateStr = date ?? todayString();
  const logPath = getDailyLogPath(dateStr);

  // Skip fs check if we already verified today
  if (lastLogDate === dateStr) {
    return logPath;
  }

  const dir = resolvePath(MEMORY_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (!existsSync(logPath)) {
    const header = `# Daily Log - ${dateStr}\n\n`;
    writeFileSync(logPath, header, 'utf-8');
  }

  lastLogDate = dateStr;
  return logPath;
}

/**
 * Append a timestamped entry to today's daily log.
 *
 * @param content - The memory content that was added
 * @param entryType - The type of memory entry (fact, preference, etc.)
 * @param source - Where the memory came from (manual, telegram, etc.)
 */
export function appendToDailyLog(
  content: string,
  entryType: string,
  source: string
): void {
  const logPath = ensureDailyLog();
  const now = new Date();
  const time = now.toTimeString().split(' ')[0]; // HH:MM:SS

  // Truncate long content for the log line
  const truncated = content.length > 200
    ? content.substring(0, 197) + '...'
    : content;

  const line = `- **${time}** [${entryType}] (${source}) ${truncated}\n`;
  appendFileSync(logPath, line, 'utf-8');
}

/**
 * Reset the cached date (for testing).
 */
export function _resetDailyLogCache(): void {
  lastLogDate = null;
}
