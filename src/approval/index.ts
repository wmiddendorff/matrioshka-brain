/**
 * Approval Module
 *
 * Reusable approval system for soul updates, Telegram pairing,
 * and heartbeat actions.
 */

export type { Approval, ApprovalRow, ApprovalStatus, ApprovalType } from './types.js';
export { rowToApproval } from './types.js';

export {
  getApprovalDb,
  createApproval,
  getApproval,
  listPendingApprovals,
  updateApprovalStatus,
  expireOldApprovals,
  closeApprovalDb,
  initApprovalDbFrom,
} from './db.js';
