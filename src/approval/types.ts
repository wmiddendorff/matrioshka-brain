/**
 * Approval Module Types
 *
 * Type definitions for the approval system. Used for soul file updates,
 * Telegram pairing, and heartbeat actions.
 */

/** Types of actions that can require approval */
export type ApprovalType = 'soul_update' | 'telegram_pair' | 'heartbeat_action';

/** Status of an approval request */
export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired';

/** An approval request */
export interface Approval {
  id: string;
  type: ApprovalType;
  payload: Record<string, unknown>;
  createdAt: number;
  expiresAt: number | null;
  status: ApprovalStatus;
}

/** Raw database row for an approval */
export interface ApprovalRow {
  id: string;
  type: string;
  payload: string;
  created_at: number;
  expires_at: number | null;
  status: string;
}

/** Convert a database row to an Approval */
export function rowToApproval(row: ApprovalRow): Approval {
  return {
    id: row.id,
    type: row.type as ApprovalType,
    payload: JSON.parse(row.payload),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    status: row.status as ApprovalStatus,
  };
}
