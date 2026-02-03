# Autonomy Module - API Reference

## MCP Tools

### heartbeat_status

Get the current state of the heartbeat scheduler.

**Input:** `{}` (no parameters)

**Output:**

```json
{
  "enabled": true,
  "paused": false,
  "interval": 1800000,
  "lastRun": 1706900000000,
  "nextRun": 1706901800000,
  "pendingTasks": 3,
  "inActiveHours": true
}
```

### heartbeat_pause

Pause the heartbeat scheduler. The timer keeps running but ticks are skipped.

**Input:** `{}` (no parameters)

**Output:**

```json
{
  "success": true,
  "wasPaused": false
}
```

### heartbeat_resume

Resume the heartbeat scheduler after being paused.

**Input:** `{}` (no parameters)

**Output:**

```json
{
  "success": true,
  "nextRun": 1706901800000
}
```

## Programmatic API

### Audit Module

```typescript
import { auditLog, getRecentAuditEntries } from 'mudpuppy/audit';
```

#### `auditLog(entry: AuditEntry): void`

Append an entry to the JSONL audit log at `data/audit.log`.

```typescript
auditLog({
  timestamp: Date.now(),
  tool: 'config_get',
  input: { path: 'version' },
  output: { value: '2.0.0' },
  source: 'heartbeat',
  durationMs: 12,
  success: true,
});
```

#### `getRecentAuditEntries(limit?: number): AuditEntry[]`

Read the most recent N entries from the audit log (newest first).

```typescript
const entries = getRecentAuditEntries(10);
// entries[0] is the most recent
```

### AuditEntry Interface

```typescript
interface AuditEntry {
  timestamp: number;       // Unix timestamp in ms
  tool: string;           // Tool name that was executed
  input: Record<string, unknown>;   // Tool input parameters
  output: Record<string, unknown>;  // Tool output or error
  source: string;         // 'heartbeat', 'mcp', or 'cli'
  durationMs: number;     // Execution duration in ms
  success: boolean;       // Whether the tool call succeeded
  error?: string;         // Error message if failed
}
```

### Parser Module

```typescript
import { parseHeartbeatMd, markTaskDone } from 'mudpuppy/autonomy';
```

#### `parseHeartbeatMd(content: string): HeartbeatTask[]`

Parse HEARTBEAT.md content string into an array of tasks.

```typescript
const content = '## Recurring\n- [ ] @telegram_poll\n- [ ] Check email\n';
const tasks = parseHeartbeatMd(content);
// [
//   { text: '@telegram_poll', section: 'recurring', toolCall: { tool: 'telegram_poll', input: {} }, lineIndex: 1 },
//   { text: 'Check email', section: 'recurring', lineIndex: 2 },
// ]
```

#### `markTaskDone(content: string, lineIndex: number): string`

Replace `- [ ]` with `- [x]` at the given line index.

```typescript
const updated = markTaskDone(content, 1);
```

### Scheduler Module

```typescript
import { HeartbeatScheduler, getScheduler, isInActiveHours } from 'mudpuppy/autonomy';
```

#### `new HeartbeatScheduler(options: HeartbeatOptions)`

Create a new scheduler instance.

```typescript
const scheduler = new HeartbeatScheduler({
  interval: 1800000,
  activeHours: { start: '09:00', end: '22:00', timezone: 'America/New_York' },
  maxActionsPerBeat: 5,
  requireApproval: true,
});
```

#### `scheduler.start(): void`

Start the interval timer.

#### `scheduler.stop(): void`

Stop the interval timer.

#### `scheduler.pause(): boolean`

Pause execution. Returns the previous paused state.

#### `scheduler.resume(): void`

Resume execution.

#### `scheduler.getState(): HeartbeatState`

Get the current scheduler state.

#### `getScheduler(): HeartbeatScheduler | null`

Get the singleton scheduler instance (set when a scheduler is created).

#### `isInActiveHours(config?): boolean`

Check if the current time falls within configured active hours. Returns `true` if no config is provided.

### Type Definitions

```typescript
type TaskSection = 'recurring' | 'one-time' | 'unknown';

interface HeartbeatTask {
  text: string;
  section: TaskSection;
  toolCall?: { tool: string; input: Record<string, unknown> };
  lineIndex: number;
}

interface HeartbeatState {
  enabled: boolean;
  paused: boolean;
  interval: number;
  lastRun: number | null;
  nextRun: number | null;
  pendingTasks: number;
  inActiveHours: boolean;
}

interface HeartbeatResult {
  tasksFound: number;
  tasksExecuted: number;
  tasksFailed: number;
  tasksSkipped: number;
  approvalsPending: number;
  actions: ActionResult[];
}

interface ActionResult {
  task: string;
  tool: string;
  success: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
}

interface HeartbeatOptions {
  interval: number;
  activeHours?: { start: string; end: string; timezone: string };
  maxActionsPerBeat: number;
  requireApproval: boolean;
}
```

## CLI Commands

### `mudpuppy heartbeat status`

Show heartbeat configuration and pending task count.

```
Heartbeat: Enabled
Interval: 30 minutes
Require Approval: Yes
Max Actions/Beat: 5
Active Hours: 09:00 - 22:00 (America/New_York)

Pending tasks: 3 (2 executable, 1 manual)
```

### `mudpuppy heartbeat pause`

Show instructions for pausing via MCP tool (scheduler runs in MCP server process).

### `mudpuppy heartbeat resume`

Show instructions for resuming via MCP tool.
