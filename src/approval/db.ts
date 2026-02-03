/**
 * Approval Database Module
 *
 * SQLite database for approval requests. Separate from memory.db
 * because it has no vector search needs and serves a different concern.
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { resolvePath } from '../config.js';
import type { Approval, ApprovalRow, ApprovalStatus, ApprovalType } from './types.js';
import { rowToApproval } from './types.js';

const DB_PATH = 'data/approvals.db';

/** Singleton database instance */
let dbInstance: Database.Database | null = null;

/**
 * Get or create the approvals database instance.
 */
export function getApprovalDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbPath = resolvePath(DB_PATH);
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  initSchema(db);

  dbInstance = db;
  return db;
}

/**
 * Initialize the approval database schema.
 */
function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_approvals (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER,
      status TEXT DEFAULT 'pending'
    );

    CREATE INDEX IF NOT EXISTS idx_approval_status ON pending_approvals(status);
    CREATE INDEX IF NOT EXISTS idx_approval_type ON pending_approvals(type);
  `);
}

/**
 * Create a new approval request.
 */
export function createApproval(
  db: Database.Database,
  type: ApprovalType,
  payload: Record<string, unknown>,
  expiresAt?: number
): Approval {
  const id = randomUUID();
  const now = Date.now();

  db.prepare(`
    INSERT INTO pending_approvals (id, type, payload, created_at, expires_at, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(id, type, JSON.stringify(payload), now, expiresAt ?? null);

  return {
    id,
    type,
    payload,
    createdAt: now,
    expiresAt: expiresAt ?? null,
    status: 'pending',
  };
}

/**
 * Get an approval by ID.
 */
export function getApproval(db: Database.Database, id: string): Approval | null {
  const row = db.prepare(
    'SELECT * FROM pending_approvals WHERE id = ?'
  ).get(id) as ApprovalRow | undefined;

  if (!row) return null;
  return rowToApproval(row);
}

/**
 * List pending approval requests, optionally filtered by type.
 */
export function listPendingApprovals(
  db: Database.Database,
  type?: ApprovalType
): Approval[] {
  let rows: ApprovalRow[];

  if (type) {
    rows = db.prepare(
      'SELECT * FROM pending_approvals WHERE status = ? AND type = ? ORDER BY created_at DESC'
    ).all('pending', type) as ApprovalRow[];
  } else {
    rows = db.prepare(
      'SELECT * FROM pending_approvals WHERE status = ? ORDER BY created_at DESC'
    ).all('pending') as ApprovalRow[];
  }

  return rows.map(rowToApproval);
}

/**
 * Update the status of an approval.
 */
export function updateApprovalStatus(
  db: Database.Database,
  id: string,
  status: ApprovalStatus
): boolean {
  const result = db.prepare(
    'UPDATE pending_approvals SET status = ? WHERE id = ?'
  ).run(status, id);

  return result.changes > 0;
}

/**
 * Expire old pending approvals that have passed their expiration time.
 * Returns the number of expired approvals.
 */
export function expireOldApprovals(db: Database.Database): number {
  const now = Date.now();
  const result = db.prepare(
    'UPDATE pending_approvals SET status = ? WHERE status = ? AND expires_at IS NOT NULL AND expires_at < ?'
  ).run('expired', 'pending', now);

  return result.changes;
}

/**
 * Close the database connection. Used for testing cleanup.
 */
export function closeApprovalDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Initialize from an existing Database instance. Used for testing.
 */
export function initApprovalDbFrom(db: Database.Database): void {
  initSchema(db);
  dbInstance = db;
}
