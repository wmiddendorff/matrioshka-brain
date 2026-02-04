# Security API Reference

## Approval System

### Types

```typescript
type ApprovalType = 'soul_update' | 'telegram_pair' | 'heartbeat_action';
type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired';

interface Approval {
  id: string;           // UUID
  type: ApprovalType;
  payload: string;      // JSON-serialized context
  createdAt: number;    // Unix timestamp (ms)
  expiresAt: number | null;
  status: ApprovalStatus;
}
```

### Database Functions

All functions operate on a SQLite database at `~/.matrioshka-brain/data/approvals.db`.

#### `createApproval(db, type, payload, expiresAt?)`

Create a pending approval request.

```typescript
import { getApprovalDb, createApproval } from './approval/index.js';

const db = getApprovalDb();
const id = createApproval(db, 'soul_update', JSON.stringify({
  file: 'soul',
  diff: '--- SOUL.md\n+++ SOUL.md\n...',
  reason: 'Adding communication preference'
}));
// Returns: UUID string
```

#### `getApproval(db, id)`

Fetch a single approval by ID.

```typescript
const approval = getApproval(db, id);
// Returns: Approval | undefined
```

#### `listPendingApprovals(db, type?)`

List all pending approvals, newest first. Optionally filter by type.

```typescript
const all = listPendingApprovals(db);
const soulOnly = listPendingApprovals(db, 'soul_update');
// Returns: Approval[]
```

#### `updateApprovalStatus(db, id, status)`

Change an approval's status. Used by CLI `soul approve` / `soul deny`.

```typescript
updateApprovalStatus(db, id, 'approved');
```

#### `expireOldApprovals(db)`

Expire approvals past their `expiresAt` timestamp. Called periodically.

```typescript
const count = expireOldApprovals(db);
// Returns: number of expired approvals
```

### Schema

```sql
CREATE TABLE pending_approvals (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX idx_status ON pending_approvals(status);
CREATE INDEX idx_type ON pending_approvals(type);
```

## Audit Logger

### Types

```typescript
interface AuditEntry {
  timestamp: number;              // Date.now()
  tool: string;                   // Tool name (e.g., "telegram_send")
  input: Record<string, unknown>; // Tool input
  output: Record<string, unknown>;// Tool output
  source: 'heartbeat' | 'mcp' | 'cli';
  durationMs: number;
  success: boolean;
  error?: string;                 // Present when success=false
}
```

### Functions

#### `auditLog(entry)`

Append an entry to `~/.matrioshka-brain/data/audit.log`. Creates the directory if missing.

```typescript
import { auditLog } from './audit/index.js';

await auditLog({
  timestamp: Date.now(),
  tool: 'telegram_send',
  input: { userId: 12345, text: 'Hello' },
  output: { success: true },
  source: 'heartbeat',
  durationMs: 42,
  success: true
});
```

#### `getRecentAuditEntries(limit?)`

Read the last N entries from the audit log. Returns newest first. Skips malformed lines.

```typescript
import { getRecentAuditEntries } from './audit/index.js';

const entries = await getRecentAuditEntries(50);
// Returns: AuditEntry[]
```

### File Format

One JSON object per line (JSONL), append-only:

```
{"timestamp":1706918400000,"tool":"heartbeat_tick","input":{},"output":{"tasksExecuted":2},"source":"heartbeat","durationMs":150,"success":true}
{"timestamp":1706918401000,"tool":"telegram_send","input":{"userId":123,"text":"Hi"},"output":{"success":true},"source":"heartbeat","durationMs":42,"success":true}
```

## CLI Commands

### Soul Approval

```bash
# List pending proposals
matrioshka-brain soul list

# Show proposal details with diff
matrioshka-brain soul show <approval-id>

# Approve (applies the update to the soul file)
matrioshka-brain soul approve <approval-id>

# Deny (marks as denied, no file changes)
matrioshka-brain soul deny <approval-id>
```

### Heartbeat Control

```bash
# Check if heartbeat is running and what's pending
matrioshka-brain heartbeat status

# Pause autonomous execution
matrioshka-brain heartbeat pause

# Resume autonomous execution
matrioshka-brain heartbeat resume
```

## Config Options

### `security.approvalRequired`

Array of operation names that require approval. Default: `["soul_propose_update", "telegram_pair"]`.

```bash
matrioshka-brain config get security.approvalRequired
matrioshka-brain config set security.approvalRequired '["soul_propose_update"]'
```

### `security.auditLog`

Enable/disable audit logging. Default: `true`.

```bash
matrioshka-brain config set security.auditLog true
```

### `security.maxMessageLength`

Maximum allowed message length for Telegram sends. Default: `4096`.

### `heartbeat.requireApproval`

When `true`, heartbeat actions create approval requests instead of executing directly. Default: `true`.

```bash
matrioshka-brain config set heartbeat.requireApproval false  # Live dangerously
```

### `heartbeat.maxActionsPerBeat`

Maximum tools executed per heartbeat tick. Default: `5`.

### `heartbeat.activeHours`

Time window for autonomous execution:

```bash
matrioshka-brain config set heartbeat.activeHours '{"start":"08:00","end":"22:00","timezone":"America/New_York"}'
```
