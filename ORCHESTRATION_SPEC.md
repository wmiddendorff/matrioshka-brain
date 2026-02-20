# Orchestration Layer Specification

## Overview
Build an external orchestration layer that triggers Claude Code CLI sessions to interact with Matrioshka Brain's MCP tools. This bridges the gap between MB's internal capabilities (MCP server, heartbeat scheduler, memory, telegram) and actual autonomous execution.

## Architecture

```
┌──────────────────────┐
│   systemd timer      │  ← periodic trigger (every 5-15 min)
│   or cron            │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   mb-orchestrator    │  ← Node.js CLI (src/orchestrator/)
│                      │
│  1. Acquire lock     │
│  2. Check triggers   │
│  3. Build prompt     │
│  4. Spawn claude CLI │
│  5. Capture output   │
│  6. Log results      │
│  7. Release lock     │
└──────────────────────┘
           │
           ▼
┌──────────────────────┐
│   claude -p "..."    │  ← Claude Code with .mcp.json
│   (or codex)         │     connecting to MB MCP server
└──────────────────────┘
```

## Components to Build

### 1. `src/orchestrator/runner.ts` — Core Runner
- Acquires file lock (`~/.matrioshka-brain/orchestrator.lock`) to prevent overlapping sessions
- Checks what needs to be done (heartbeat due? telegram messages pending? scheduled tasks?)
- Builds appropriate prompt for Claude Code
- Spawns `claude -p` with the project directory (so .mcp.json is loaded)
- Captures stdout, handles timeouts (default 5 min, configurable)
- Logs session results to `~/.matrioshka-brain/logs/orchestrator/`
- Returns structured result

### 2. `src/orchestrator/triggers.ts` — Trigger Detection
Checks multiple sources and returns what needs action:
- **Telegram**: Read `~/.matrioshka-brain/telegram-queue.jsonl` for pending messages
- **Heartbeat**: Check if heartbeat interval has elapsed since last run
- **Cron Jobs**: Check `~/.matrioshka-brain/cron/jobs.json` for due jobs
- **Manual**: Accept explicit task via CLI argument
- Returns prioritized list of triggers

### 3. `src/orchestrator/prompts.ts` — Prompt Builder
Builds context-aware prompts for Claude Code:
- For telegram messages: "You have N pending Telegram messages. Use telegram_poll to read them, then respond appropriately using telegram_send."
- For heartbeat: "Run your heartbeat check. Use heartbeat_status to see pending tasks, then execute them."
- For cron: "Execute scheduled task: [description]"
- For manual: Pass through the user's task text
- Always prepends: "You are running in autonomous mode via the orchestrator. Be concise. Complete the task and exit."

### 4. `src/orchestrator/lockfile.ts` — Lock Management
- PID-based lockfile at `~/.matrioshka-brain/orchestrator.lock`
- Stale lock detection (check if PID is still alive)
- Configurable lock timeout
- Force-unlock capability

### 5. `src/orchestrator/logger.ts` — Session Logger
- JSONL log at `~/.matrioshka-brain/logs/orchestrator/YYYY-MM-DD.jsonl`
- Each entry: timestamp, trigger type, prompt summary, duration, exit code, output summary, tokens used (if parseable)
- Log rotation (keep 30 days)

### 6. `src/cli/orchestrator.ts` — CLI Commands
Add to existing CLI:
```bash
mb orchestrate              # Auto-detect triggers and run
mb orchestrate --heartbeat  # Force heartbeat run
mb orchestrate --telegram   # Process telegram messages
mb orchestrate --task "..." # Run arbitrary task
mb orchestrate --status     # Show orchestrator status (last run, lock state, etc.)
mb orchestrate --unlock     # Force-release stale lock
```

### 7. `deploy/systemd/` — systemd Unit Files
```ini
# mb-orchestrator.service
[Unit]
Description=Matrioshka Brain Orchestrator
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/bin/node /path/to/dist/cli/index.js orchestrate
Environment=MATRIOSHKA_BRAIN_HOME=%h/.matrioshka-brain
TimeoutStartSec=600
User=%i

# mb-orchestrator.timer
[Timer]
OnBootSec=2min
OnUnitActiveSec=10min
RandomizedDelaySec=60

[Install]
WantedBy=timers.target
```

### 8. `deploy/cron/` — cron Alternative
Simple crontab entry for systems without systemd:
```cron
*/10 * * * * cd /path/to/matrioshka-brain && node dist/cli/index.js orchestrate >> ~/.matrioshka-brain/logs/cron.log 2>&1
```

## Configuration
Add to `config.json`:
```json
{
  "orchestrator": {
    "enabled": true,
    "cli": "claude",
    "cliArgs": ["-p"],
    "maxSessionDuration": 300,
    "lockTimeout": 600,
    "triggers": {
      "telegram": true,
      "heartbeat": true,
      "cron": true
    },
    "quietHours": {
      "start": "23:00",
      "end": "08:00",
      "timezone": "America/Detroit"
    },
    "logRetentionDays": 30
  }
}
```

## Testing
- Unit tests for trigger detection, prompt building, lock management
- Integration test that runs a mock claude CLI
- E2E test with actual Claude Code (manual verification)

## Files to Create/Modify
- CREATE: `src/orchestrator/runner.ts`
- CREATE: `src/orchestrator/triggers.ts`
- CREATE: `src/orchestrator/prompts.ts`
- CREATE: `src/orchestrator/lockfile.ts`
- CREATE: `src/orchestrator/logger.ts`
- CREATE: `src/orchestrator/index.ts`
- CREATE: `src/orchestrator/types.ts`
- CREATE: `deploy/systemd/mb-orchestrator.service`
- CREATE: `deploy/systemd/mb-orchestrator.timer`
- CREATE: `deploy/cron/install.sh`
- CREATE: `tests/orchestrator/runner.test.ts`
- CREATE: `tests/orchestrator/triggers.test.ts`
- CREATE: `tests/orchestrator/lockfile.test.ts`
- CREATE: `tests/orchestrator/prompts.test.ts`
- MODIFY: `src/cli/index.ts` — add orchestrate subcommand
- MODIFY: `src/config.ts` — add orchestrator config schema
