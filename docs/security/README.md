# Security Model

Mudpuppy follows a **security-first** design philosophy: capabilities are restricted by default and explicitly granted. This document covers the threat model, security controls, and operational boundaries.

## Threat Model

### Risks

| Threat | Mitigation |
|--------|------------|
| **Runaway autonomous execution** | `maxActionsPerBeat` limit, active hours, pause/resume |
| **Unauthorized personality changes** | Approval system gates all soul updates |
| **Unauthorized Telegram access** | Pairing system requires explicit approval per user |
| **Secret leakage** | `secrets.env` gitignored, never loaded into tool responses |
| **Audit evasion** | All heartbeat actions logged automatically to JSONL |
| **Memory poisoning** | Content hash deduplication, importance/confidence metadata |
| **Privilege escalation** | No shell execution tools, limited to registered MCP tools |
| **Data exfiltration** | No outbound network tools, Telegram only sends to paired users |

### Trust Boundaries

1. **User ↔ Agent**: The user trusts the agent to follow SOUL.md and AGENTS.md boundaries. The approval system ensures the agent cannot unilaterally change these.
2. **Agent ↔ Telegram**: Only paired users can send messages. Pairing requires human approval.
3. **Agent ↔ Filesystem**: Limited to `~/.mudpuppy/` workspace. No arbitrary file access.
4. **Agent ↔ Autonomy**: Heartbeat actions can require approval before execution. Active hours limit when autonomous actions occur.

## Security Controls

### 1. Approval System

Three types of operations require explicit human approval:

| Approval Type | Trigger | Approval Method |
|---------------|---------|-----------------|
| `soul_update` | `soul_propose_update` tool | `mudpuppy soul approve <id>` |
| `telegram_pair` | User sends `/start` to bot | `telegram_pair {action: "approve"}` |
| `heartbeat_action` | Heartbeat tick (when `requireApproval: true`) | `mudpuppy soul approve <id>` |

Approvals are stored in `~/.mudpuppy/data/approvals.db` (SQLite, WAL mode). Expired approvals are automatically cleaned up.

### 2. Audit Logging

All heartbeat actions are logged to `~/.mudpuppy/data/audit.log` in JSONL format:

```json
{
  "timestamp": 1706918400000,
  "tool": "telegram_send",
  "input": {"userId": 12345, "text": "Hello"},
  "output": {"success": true},
  "source": "heartbeat",
  "durationMs": 42,
  "success": true
}
```

Sources: `heartbeat` (autonomous), `mcp` (user-initiated), `cli` (command line).

### 3. Secrets Management

- Bot tokens stored in `~/.mudpuppy/secrets.env`
- Loaded via `dotenv` at runtime, never serialized into responses
- `secrets.env` is in `.gitignore`
- `SecretsManager.get(key)` and `set(key, value)` API
- No secrets in `config.json` or memory database

### 4. Input Validation

Every MCP tool validates input with a Zod schema before execution. Invalid input returns an error without executing the tool. This prevents:
- Type confusion attacks
- Unexpected field injection
- Oversized payloads (`maxMessageLength: 4096`)

### 5. Rate Limiting

- `maxActionsPerBeat` (default: 5) limits tools executed per heartbeat tick
- Heartbeat interval (default: 30 minutes) limits tick frequency
- Active hours window prevents off-hours execution

### 6. Process Isolation

The Telegram bot runs as a separate daemon process:
- Communicates via Unix socket IPC (newline-delimited JSON)
- PID file at `~/.mudpuppy/telegram.pid`
- Crash doesn't affect MCP server
- MCP server crash doesn't affect message queue

## Configuration

Security-related configuration in `config.json`:

```json
{
  "heartbeat": {
    "enabled": false,
    "interval": 1800000,
    "requireApproval": true,
    "maxActionsPerBeat": 5,
    "activeHours": {
      "start": "08:00",
      "end": "22:00",
      "timezone": "America/New_York"
    }
  },
  "security": {
    "approvalRequired": ["soul_propose_update", "telegram_pair"],
    "auditLog": true,
    "maxMessageLength": 4096
  }
}
```

### Defaults (Security-First)

| Setting | Default | Rationale |
|---------|---------|-----------|
| `telegram.enabled` | `false` | Opt-in only |
| `heartbeat.enabled` | `false` | Opt-in only |
| `heartbeat.requireApproval` | `true` | Human-in-the-loop for autonomous actions |
| `security.auditLog` | `true` | Always log by default |
| `security.approvalRequired` | `["soul_propose_update", "telegram_pair"]` | Gate sensitive operations |

## Operations That Cannot Be Bypassed

Even with full configuration access, the agent cannot:

1. **Approve its own soul updates** — approvals require CLI or external action
2. **Send Telegram messages to unpaired users** — bot enforces pairing at the protocol level
3. **Execute tools not in the registry** — MCP server only exposes registered tools
4. **Disable audit logging retroactively** — past log entries are append-only JSONL
5. **Access files outside the workspace** — MCP tools only operate on `~/.mudpuppy/`

## Related Documentation

- [API Reference](./API.md) — Approval and audit function signatures
- [Implementation Details](./IMPLEMENTATION.md) — How security controls are built
- [Testing](./TESTING.md) — Security audit checklist and test results
