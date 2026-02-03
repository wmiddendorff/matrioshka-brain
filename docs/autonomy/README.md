# Autonomy Module

The autonomy module provides periodic self-initiated execution via the **heartbeat scheduler**. It reads tasks from `HEARTBEAT.md`, executes tool calls, logs actions to an audit trail, and optionally notifies via Telegram.

## Quick Start

1. Enable the heartbeat in configuration:

```bash
mudpuppy config set heartbeat.enabled true
mudpuppy config set heartbeat.interval 1800000   # 30 minutes
```

2. Edit `~/.mudpuppy/workspace/HEARTBEAT.md`:

```markdown
# Heartbeat Tasks

## Recurring
- [ ] @telegram_poll
- [ ] @memory_stats

## One-time
- [ ] @telegram_send {"userId":123,"text":"Setup complete!"}

---
HEARTBEAT_OK
```

3. The scheduler runs inside the MCP server process. It will execute `@tool` tasks at the configured interval.

## Key Concepts

### Task Format

Tasks in `HEARTBEAT.md` follow this convention:

- `- [ ] @tool_name` — Auto-executable tool call with empty input
- `- [ ] @tool_name {"arg":"val"}` — Auto-executable with JSON input
- `- [ ] Plain text task` — Counted as pending but not auto-executed
- `- [x] ...` — Completed tasks (skipped by parser)

### Sections

- **`## Recurring`** — Tasks stay unchecked after execution
- **`## One-time`** — Tasks marked `- [x]` after successful execution

### Approval

When `heartbeat.requireApproval` is `true` (default), tool executions create approval requests instead of running immediately. Approve via CLI:

```bash
mudpuppy soul list    # also shows heartbeat_action approvals
mudpuppy soul approve <id>
```

## Architecture

```
┌─────────────────┐
│  MCP Server      │
│  (mcp-server.ts) │
│                  │
│  ┌────────────┐  │     ┌──────────────┐
│  │ Scheduler  │──┼────►│ HEARTBEAT.md │
│  │ (interval) │  │     └──────────────┘
│  └──────┬─────┘  │
│         │        │     ┌──────────────┐
│         ├───────►┼────►│ Tool Registry│
│         │        │     └──────────────┘
│         │        │
│         ├───────►┼────►│ Audit Log    │
│         │        │     └──────────────┘
│         │        │
│         └───────►┼────►│ Telegram     │
│                  │     │ (optional)   │
└──────────────────┘     └──────────────┘
```

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `heartbeat.enabled` | boolean | `false` | Enable the heartbeat scheduler |
| `heartbeat.interval` | number | `1800000` | Interval in ms between beats (30 min) |
| `heartbeat.maxActionsPerBeat` | number | `5` | Max tool executions per beat |
| `heartbeat.requireApproval` | boolean | `true` | Require approval before executing |
| `heartbeat.activeHours.start` | string | — | Start time (HH:MM) |
| `heartbeat.activeHours.end` | string | — | End time (HH:MM) |
| `heartbeat.activeHours.timezone` | string | — | IANA timezone (e.g., `America/New_York`) |

## MCP Tools

| Tool | Description |
|------|-------------|
| `heartbeat_status` | Get scheduler state (enabled, paused, lastRun, nextRun, pendingTasks) |
| `heartbeat_pause` | Pause execution (timer keeps running, ticks skipped) |
| `heartbeat_resume` | Resume execution |

## CLI Commands

```bash
mudpuppy heartbeat status    # Show heartbeat configuration and task count
mudpuppy heartbeat pause     # Instructions for pausing via MCP tool
mudpuppy heartbeat resume    # Instructions for resuming via MCP tool
```

## Related Documentation

- [API Reference](./API.md)
- [Implementation Details](./IMPLEMENTATION.md)
- [Testing Strategy](./TESTING.md)
- [Audit Module](./IMPLEMENTATION.md#audit-module)
