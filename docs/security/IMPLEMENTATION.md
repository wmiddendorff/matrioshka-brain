# Security Implementation Details

## Approval Flow

### Soul Update Flow

```
Agent calls soul_propose_update
  ├── Reads current file content
  ├── Generates unified diff (LCS algorithm)
  ├── Creates approval in SQLite (status: pending)
  └── Returns proposal ID + diff to agent

User runs `mudpuppy soul show <id>`
  └── Displays diff for review

User runs `mudpuppy soul approve <id>`
  ├── Updates approval status to 'approved'
  └── Writes new content to soul file

User runs `mudpuppy soul deny <id>`
  └── Updates approval status to 'denied' (no file change)
```

Key: The agent never writes to soul files directly. The CLI is the only path to apply approved changes.

### Telegram Pairing Flow

```
Unknown user sends /start to bot
  ├── Bot creates pairing request in SQLite queue
  └── Bot replies: "Pairing request sent"

Agent calls telegram_pair {action: "list"}
  └── Returns pending requests with usernames

Agent informs user about the request

User decides → Agent calls telegram_pair {action: "approve/deny", userId: X}
  ├── Bot marks user as paired/rejected
  └── Future messages from paired users are queued
```

Key: Messages from unpaired users are silently dropped (except `/start`).

### Heartbeat Approval Flow

When `heartbeat.requireApproval = true`:

```
Scheduler tick fires
  ├── Parses HEARTBEAT.md for unchecked tasks
  ├── For each @tool task:
  │   ├── Creates heartbeat_action approval
  │   └── Logs creation to audit trail
  └── Returns summary (N approvals created)

User reviews and approves via CLI
```

When `heartbeat.requireApproval = false`:

```
Scheduler tick fires
  ├── Parses HEARTBEAT.md for unchecked tasks
  ├── For each @tool task (up to maxActionsPerBeat):
  │   ├── Executes tool via executeTool()
  │   ├── Logs result to audit trail
  │   └── Marks one-time tasks as done
  └── Sends Telegram summary (if bot connected)
```

## Three Approval Types

| Type | Source | Payload | How Approved |
|------|--------|---------|--------------|
| `soul_update` | `soul_propose_update` tool | `{file, diff, newContent, reason}` | `mudpuppy soul approve` |
| `telegram_pair` | User sends `/start` | `{userId, username}` | `telegram_pair {action: "approve"}` |
| `heartbeat_action` | Scheduler tick | `{tool, input, task}` | `mudpuppy soul approve` |

All approvals share the same database table and lifecycle (pending → approved/denied/expired).

## Audit JSONL Format

Each line in `~/.mudpuppy/data/audit.log` is a self-contained JSON object:

```json
{
  "timestamp": 1706918400000,
  "tool": "telegram_send",
  "input": {"userId": 12345, "text": "Daily update"},
  "output": {"success": true},
  "source": "heartbeat",
  "durationMs": 42,
  "success": true
}
```

### Design Decisions

- **JSONL over SQLite**: Human-readable, grep-friendly, append-only (no corruption risk from concurrent writes)
- **No rotation**: File grows indefinitely. Users can truncate or rotate externally.
- **Malformed line handling**: `getRecentAuditEntries()` silently skips unparseable lines
- **No sensitive data**: Input/output are logged as-is. Secrets should never appear in tool inputs.

### What Gets Logged

| Event | Logged? | Source |
|-------|---------|--------|
| Heartbeat tick start/end | Yes | `heartbeat` |
| Tool execution during heartbeat | Yes (each tool) | `heartbeat` |
| MCP tool calls | Configurable | `mcp` |
| CLI commands | Not currently | - |
| Approval create/update | Not directly (approval DB tracks state) | - |

## Secrets Management

### Storage

Secrets live in `~/.mudpuppy/secrets.env`:

```
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
```

### Implementation (`src/secrets.ts`)

- `SecretsManager.get(key)`: Read from `secrets.env` via dotenv
- `SecretsManager.set(key, value)`: Append/update in `secrets.env`
- File created on first `set()` call
- Never loaded into config.json or tool responses

### Protection

- `.gitignore` includes `secrets.env`
- `config.json` contains no secrets (only feature flags and thresholds)
- Memory indexer does not index `secrets.env` or `.env` files
- Bot token is passed to grammY at daemon startup, not stored in memory DB

## Active Hours

### Implementation (`src/autonomy/scheduler.ts`)

```typescript
function isInActiveHours(config?: ActiveHoursConfig): boolean {
  if (!config) return true; // No config = always active

  const now = new Date();
  // Convert to configured timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit', minute: '2-digit',
    hour12: false, timeZone: config.timezone
  });
  const currentTime = formatter.format(now); // "HH:MM"

  return currentTime >= config.start && currentTime <= config.end;
}
```

- Checked at every scheduler tick before processing tasks
- Uses `Intl.DateTimeFormat` for timezone conversion (no external dependencies)
- Supports any IANA timezone string

## Input Validation (Zod)

Every MCP tool defines a Zod schema. The tool registry validates before execution:

```typescript
// In tools/index.ts
async function executeTool(name: string, input: unknown) {
  const tool = getTool(name);
  const validated = tool.schema.parse(input); // Throws ZodError on invalid
  return tool.handler(validated);
}
```

Example schema (telegram_send):

```typescript
z.object({
  userId: z.number().int().positive(),
  text: z.string().min(1).max(4096),
  parseMode: z.enum(['HTML', 'Markdown', 'MarkdownV2']).optional(),
  disableLinkPreview: z.boolean().optional(),
  replyToMessageId: z.number().int().optional()
})
```

This prevents:
- Sending messages to non-numeric user IDs
- Empty or oversized messages
- Unexpected field injection (Zod strips unknown fields)

## Memory Security

### Content Hash Deduplication

Every memory entry is hashed with SHA-256 on insertion. Duplicate content returns the existing entry instead of creating a new one. This prevents:
- Repeated injection of the same content
- Memory bloat from redundant entries

### Access Logging

Every `memory_get` call logs the retrieval to `memory_access_log`:

```sql
CREATE TABLE memory_access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER REFERENCES memory_entries(id),
  accessed_at INTEGER NOT NULL
);
```

This enables:
- Analytics on which memories are most accessed
- Detection of unusual access patterns
- Informed pruning decisions

### File Indexer Boundaries

The file auto-indexer (`src/memory/indexer.ts`):
- Only indexes files in `~/.mudpuppy/workspace/`
- Skips `.env`, `secrets.env`, and dotfiles
- Uses content hash to avoid re-indexing unchanged files
- Entries tagged with `source: 'file-index'` (excluded from daily log to prevent feedback loops)
