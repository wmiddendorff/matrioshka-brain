# Autonomy Module - Implementation Details

## Architecture

The autonomy module consists of two sub-modules:

### Audit Module (`src/audit/`)

A simple JSONL-based audit logger. Every tool execution by the heartbeat (and eventually other sources) is logged as a single JSON line to `data/audit.log`.

**Design decisions:**
- **JSONL format** — Simple, append-only, grep-friendly. No database needed.
- **Reusable** — The audit module is independent of the heartbeat and can be used by future phases (MCP tool execution logging, CLI audit trail, etc.).
- **No rotation** — For v1, the log file grows indefinitely. Log rotation can be added later.

### Autonomy Module (`src/autonomy/`)

The heartbeat scheduler that periodically reads `HEARTBEAT.md`, parses tasks, and executes them.

**Components:**
- `types.ts` — Type definitions
- `parser.ts` — HEARTBEAT.md parser (pure function, no I/O)
- `scheduler.ts` — HeartbeatScheduler class with timer, state management, and tick handler

## Scheduler Lifecycle

```
MCP Server Boot
     │
     ▼
Config: heartbeat.enabled?
     │ yes
     ▼
new HeartbeatScheduler(options)
     │
     ▼
scheduler.start()
     │
     ▼
setInterval(tick, interval)
     │
     ▼ (every interval)
     ┌─────────────────┐
     │ _tick()          │
     │                  │
     │ 1. Check paused  │──── paused → skip
     │ 2. Check hours   │──── outside → skip
     │ 3. Read file     │──── missing → skip
     │ 4. Parse tasks   │
     │ 5. Execute @tools│
     │ 6. Audit log     │
     │ 7. Mark done     │
     │ 8. Notify        │
     └─────────────────┘
```

## Parser Design

The parser is a pure function that takes a string and returns an array of tasks. This makes it highly testable.

**Regex patterns:**
- Unchecked task: `^- \[ \] (.+)$`
- Section header: `^## (.+)$`
- Tool prefix: `^@(\w+)\s*(.*)$`

**Section detection:**
- Lines scanned top to bottom
- Current section updates when a `## Heading` is encountered
- `## Recurring` → tasks stay unchecked after execution
- `## One-time` → tasks marked `- [x]` after successful execution
- Any other heading → `unknown` section (tasks not marked done)

**Tool call parsing:**
- `@tool_name` → `{ tool: 'tool_name', input: {} }`
- `@tool_name {"key":"val"}` → `{ tool: 'tool_name', input: { key: 'val' } }`
- `@tool_name {invalid}` → treated as plain text (no toolCall)

## Execution Model

### Without Approval (`requireApproval: false`)

```
Parse tasks → For each @tool task:
  1. executeTool(tool, input) via tool registry
  2. Record ActionResult (success/failure, duration)
  3. auditLog() the execution
  4. If one-time + success: markTaskDone()
```

### With Approval (`requireApproval: true`, default)

```
Parse tasks → For each @tool task:
  1. createApproval(db, 'heartbeat_action', payload)
  2. Increment approvalsPending counter
  3. User approves via CLI later
```

Approval payload contains: `{ tool, input, taskText, section }`

## Active Hours

Active hours use `Intl.DateTimeFormat` for timezone-aware time checking:

```typescript
const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: timezone,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
```

This avoids external timezone dependencies and works with any IANA timezone.

**Midnight crossing:** When `start > end` (e.g., 22:00 - 06:00), the check uses OR logic: `current >= start || current < end`.

## Singleton Pattern

The scheduler uses a module-level singleton (`schedulerInstance`) so that MCP tools can access the running scheduler via `getScheduler()`. Only one scheduler can be active at a time.

## Telegram Notification

After each tick with actual results, the scheduler sends a summary to all paired Telegram users:

1. Check if Telegram daemon is reachable
2. Get list of paired users
3. Send HTML-formatted summary to each

This is completely optional and non-fatal — all errors are silently caught.

## File Structure

```
src/
├── audit/
│   ├── index.ts      # Re-exports
│   └── logger.ts     # auditLog(), getRecentAuditEntries()
└── autonomy/
    ├── index.ts      # Re-exports
    ├── types.ts      # Type definitions
    ├── parser.ts     # parseHeartbeatMd(), markTaskDone()
    └── scheduler.ts  # HeartbeatScheduler, getScheduler(), isInActiveHours()
```

## Error Handling

- **Failed tool call** — Logged to audit trail, does not crash the scheduler. Failed count incremented.
- **Missing HEARTBEAT.md** — Tick completes with 0 tasks found.
- **Malformed JSON in task** — Task treated as plain text (not executable).
- **Approval DB error** — Logged to console, tick continues.
- **Telegram send error** — Silently caught per user.
- **Timer callback error** — Caught by wrapping `_tick()` call in `.catch()`.
