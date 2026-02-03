/**
 * Audit Logger Module
 *
 * Appends audit entries as JSONL to data/audit.log.
 * Used by heartbeat, MCP tools, and CLI for traceability.
 */

import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'fs';
import { dirname } from 'path';
import { resolvePath } from '../config.js';

const AUDIT_LOG_PATH = 'data/audit.log';

/** A single audit trail entry */
export interface AuditEntry {
  timestamp: number;
  tool: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  source: string; // 'heartbeat', 'mcp', 'cli'
  durationMs: number;
  success: boolean;
  error?: string;
}

/**
 * Append an audit entry to the JSONL log file.
 */
export function auditLog(entry: AuditEntry): void {
  const logPath = resolvePath(AUDIT_LOG_PATH);
  const dir = dirname(logPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  appendFileSync(logPath, JSON.stringify(entry) + '\n');
}

/**
 * Read the most recent N audit entries from the log.
 * Returns entries in reverse chronological order (newest first).
 */
export function getRecentAuditEntries(limit = 50): AuditEntry[] {
  const logPath = resolvePath(AUDIT_LOG_PATH);
  if (!existsSync(logPath)) {
    return [];
  }

  const content = readFileSync(logPath, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);

  // Take the last N lines (most recent)
  const recent = lines.slice(-limit);

  const entries: AuditEntry[] = [];
  for (const line of recent) {
    try {
      entries.push(JSON.parse(line) as AuditEntry);
    } catch {
      // Skip malformed lines
    }
  }

  // Return newest first
  return entries.reverse();
}
