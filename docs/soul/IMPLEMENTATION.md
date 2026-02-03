# Soul/Identity Implementation Details

## Architecture

### Module Separation

The implementation is split into two independent modules:

1. **`src/approval/`** — Generic approval system (reusable by heartbeat, Telegram pairing)
2. **`src/soul/`** — Soul file management (templates, diff, file I/O)

This separation ensures the approval system can be used by Phase 4 (heartbeat actions) and other features without coupling to soul-specific logic.

### Database Choice

Approvals use a separate `data/approvals.db` SQLite database instead of sharing `data/memory.db`:

- No need for sqlite-vec (no vector search)
- Different lifecycle and concerns
- Simpler schema, lighter weight
- Independent of memory module availability

### No File Caching

`readSoulFile()` always reads from disk. This is intentional:

- Users may edit `SOUL.md` manually with any text editor
- Changes are immediately visible to the next `soul_read` call
- The files are small (< 10KB), so disk reads are negligible
- No cache invalidation complexity

## Diff Algorithm

The unified diff uses a standard LCS (Longest Common Subsequence) algorithm:

1. **`computeLCS()`** — Builds an (m+1) x (n+1) table of longest common subsequence lengths
2. **`buildEdits()`** — Traces back through the LCS table to produce an edit script (equal/insert/delete)
3. **`groupHunks()`** — Groups nearby changes into unified diff hunks with surrounding context lines

Performance: O(m*n) time and space where m,n are line counts. Fine for small markdown files (typically < 100 lines).

The context parameter (default: 3) controls how many unchanged lines surround each change in the output.

## Template Management

Templates are centralized in `src/soul/templates.ts`:

- Single source of truth for default bootstrap file content
- Used by both `mudpuppy init` (CLI) and `ensureBootstrapFiles()` (soul module)
- CLI's `createDefaultWorkspaceFiles()` was refactored to use these templates (DRY)

## Approval Schema

```sql
CREATE TABLE pending_approvals (
  id TEXT PRIMARY KEY,           -- UUID v4
  type TEXT NOT NULL,            -- 'soul_update', 'telegram_pair', 'heartbeat_action'
  payload TEXT NOT NULL,         -- JSON blob with type-specific data
  created_at INTEGER NOT NULL,   -- Unix timestamp ms
  expires_at INTEGER,            -- Optional expiration timestamp
  status TEXT DEFAULT 'pending'  -- 'pending', 'approved', 'denied', 'expired'
);
```

The `payload` column stores JSON specific to each approval type. For `soul_update`:

```json
{
  "file": "soul",
  "filename": "SOUL.md",
  "newContent": "# Soul\n...",
  "reason": "Learned new patterns",
  "diff": "--- current/SOUL.md\n+++ proposed/SOUL.md\n..."
}
```

## Proposal Flow

```
Agent calls soul_propose_update
  ├── readSoulFile() → get current content
  ├── unifiedDiff() → generate diff
  ├── Check: if no diff → return error
  └── createApproval() → store in DB with status 'pending'

User runs: mudpuppy soul list
  └── listPendingApprovals() → show pending items

User runs: mudpuppy soul approve <id>
  ├── getApproval() → fetch from DB
  ├── writeSoulFile() → write new content to disk
  ├── updateApprovalStatus() → mark as 'approved'
  └── appendToDailyLog() → log the event (optional)

User runs: mudpuppy soul deny <id>
  └── updateApprovalStatus() → mark as 'denied'
```

## Proposable Files

Only `soul` and `agents` can be proposed for update:

- **SOUL.md** — The agent's evolving personality
- **AGENTS.md** — Operating instructions the agent follows

Not proposable:
- **IDENTITY.md** — User-defined metadata (name, emoji), not agent-controlled
- **USER.md** — User profile, only the user should edit

This is enforced at the MCP tool level via the `proposableFileEnum` schema.

## Error Handling

- File operations use synchronous fs calls (small files, simple logic)
- Missing directories are created recursively
- The daily log append on approval is wrapped in try/catch (non-fatal)
- Tool handlers return `{ error: message }` objects rather than throwing
