# Soul/Identity API Reference

## MCP Tools

### `soul_read`

Read a soul/identity bootstrap file.

**Input:**
```json
{
  "file": "soul" | "identity" | "agents" | "user"
}
```

**Output:**
```json
{
  "file": "soul",
  "content": "# Soul\n\n## Core Essence\n...",
  "lastModified": 1706900000000
}
```

Creates the file from a default template if it does not exist.

### `soul_propose_update`

Propose a change to a soul or agents file. Creates a pending approval.

**Input:**
```json
{
  "file": "soul" | "agents",
  "newContent": "# Soul\n\n## Core Essence\nI am now evolved.\n",
  "reason": "Learned new communication preferences"
}
```

**Output (success):**
```json
{
  "proposalId": "a1b2c3d4-...",
  "diff": "--- current/SOUL.md\n+++ proposed/SOUL.md\n@@ ...",
  "status": "pending",
  "message": "Proposal created. Use \"matrioshka-brain soul list\" to view..."
}
```

**Output (no changes):**
```json
{
  "error": "No changes detected - proposed content is identical to current content."
}
```

Only `soul` and `agents` files can be proposed for update. `identity` and `user` are user-managed.

## CLI Commands

### `matrioshka-brain soul list`

List pending soul proposals.

```
$ matrioshka-brain soul list
Pending soul proposals (1):

  a1b2c3d4-e5f6-7890-abcd-ef1234567890
    File: SOUL.md (soul)
    Reason: Learned new communication preferences
    Created: 5m ago

Use "matrioshka-brain soul show <id>" to see the diff.
Use "matrioshka-brain soul approve <id>" or "matrioshka-brain soul deny <id>".
```

### `matrioshka-brain soul show <id>`

Show proposal details including the unified diff.

### `matrioshka-brain soul approve <id>`

Approve a proposal: writes the new content to the file, marks the proposal as approved, and logs the event to the daily memory log.

### `matrioshka-brain soul deny <id>`

Deny a proposal: marks it as denied without modifying the file.

## Programmatic API

### Soul Module

```typescript
import {
  readSoulFile,
  writeSoulFile,
  ensureBootstrapFiles,
  getSoulFilePath,
  getDefaultTemplate,
  unifiedDiff,
  SOUL_FILE_MAP,
} from 'matrioshka-brain';
```

#### `readSoulFile(file: SoulFileType): SoulReadResult`

Read a soul file from disk. Creates from template if missing.

```typescript
const result = readSoulFile('soul');
// { file: 'soul', content: '# Soul\n...', lastModified: 1706900000000 }
```

#### `writeSoulFile(file: SoulFileType, content: string): void`

Write content to a soul file.

#### `ensureBootstrapFiles(): void`

Create all four bootstrap files if they don't exist.

#### `getSoulFilePath(file: SoulFileType): string`

Get the filesystem path for a soul file.

#### `getDefaultTemplate(file: SoulFileType): string`

Get the default template content for a file type.

#### `unifiedDiff(oldText: string, newText: string, options?: DiffOptions): string`

Generate a unified diff between two strings.

```typescript
const diff = unifiedDiff('old\n', 'new\n', {
  context: 3,
  fromLabel: 'current/SOUL.md',
  toLabel: 'proposed/SOUL.md',
});
```

### Approval Module

```typescript
import {
  getApprovalDb,
  createApproval,
  getApproval,
  listPendingApprovals,
  updateApprovalStatus,
  expireOldApprovals,
  closeApprovalDb,
} from 'matrioshka-brain';
```

#### `createApproval(db, type, payload, expiresAt?): Approval`

Create a new pending approval request.

#### `getApproval(db, id): Approval | null`

Get an approval by ID.

#### `listPendingApprovals(db, type?): Approval[]`

List pending approvals, optionally filtered by type.

#### `updateApprovalStatus(db, id, status): boolean`

Update an approval's status. Returns false if ID not found.

#### `expireOldApprovals(db): number`

Expire pending approvals past their expiration time. Returns count expired.

## Types

```typescript
type SoulFileType = 'soul' | 'identity' | 'agents' | 'user';
type ProposableSoulFile = 'soul' | 'agents';
type ApprovalType = 'soul_update' | 'telegram_pair' | 'heartbeat_action';
type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired';

interface SoulReadResult {
  file: SoulFileType;
  content: string;
  lastModified: number;
}

interface Approval {
  id: string;
  type: ApprovalType;
  payload: Record<string, unknown>;
  createdAt: number;
  expiresAt: number | null;
  status: ApprovalStatus;
}
```
