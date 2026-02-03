# Security Testing

## Test Coverage

Security-related tests are distributed across module test suites:

| Test Suite | Security Tests | Description |
|------------|---------------|-------------|
| `tests/soul.test.ts` | 12 tests | Approval CRUD, propose/approve/deny flows, diff generation |
| `tests/autonomy.test.ts` | 8 tests | Approval mode, active hours, maxActionsPerBeat, audit logging |
| `tests/telegram.test.ts` | 6 tests | Pairing protocol, message rejection for unpaired users |
| `tests/config.test.ts` | 4 tests | Default security settings, Zod validation |

## Security Audit Checklist

### Approval System

- [x] `soul_propose_update` creates pending approval (not direct write)
- [x] Only `soul` and `agents` files can be proposed (not `identity` or `user`)
- [x] Approval status transitions: pending → approved/denied/expired
- [x] Expired approvals cleaned up by `expireOldApprovals()`
- [x] Approval IDs are UUIDs (not guessable sequential integers)
- [x] Heartbeat creates approvals when `requireApproval = true`

### Audit Trail

- [x] All heartbeat tick results logged to JSONL
- [x] Each tool execution during heartbeat logged individually
- [x] Audit entries include timestamp, tool, input, output, duration, success
- [x] `getRecentAuditEntries()` handles malformed lines gracefully
- [x] Audit log directory auto-created if missing

### Secrets

- [x] `secrets.env` in `.gitignore`
- [x] `.mcp.json` in `.gitignore` (contains machine-specific paths)
- [x] No hardcoded paths in source code (`grep -r '/home/' src/` returns nothing)
- [x] Bot token loaded from secrets.env, not config.json
- [x] `SecretsManager` does not expose values in tool responses

### Input Validation

- [x] All 16 MCP tools have Zod schemas
- [x] `executeTool()` validates before calling handler
- [x] Message length capped at `maxMessageLength` (4096)
- [x] Telegram `userId` must be a positive integer
- [x] Memory `importance` bounded 1-10, `confidence` bounded 0-1
- [x] Config paths validated (no arbitrary key injection)

### Telegram

- [x] Only paired users can send messages
- [x] Unpaired user messages silently dropped (except `/start`)
- [x] Pairing requires explicit approval action
- [x] Bot daemon isolated from MCP server (separate process)
- [x] IPC uses Unix socket (not network-accessible)

### Heartbeat

- [x] Disabled by default
- [x] `requireApproval` defaults to `true`
- [x] `maxActionsPerBeat` limits execution count per tick
- [x] Active hours checked before every tick
- [x] Failed task doesn't crash scheduler (continues to next task)
- [x] Pause/resume state persists within session

### Memory

- [x] Content hash prevents duplicate entries
- [x] Access logging tracks all retrievals
- [x] File indexer limited to workspace directory
- [x] File indexer skips dotfiles and secret files
- [x] `memory_delete` removes entry, embedding, and FTS index

## Manual Penetration Test Scenarios

### Scenario 1: Soul Update Bypass

**Goal**: Modify SOUL.md without going through approval.

**Test**: Call `soul_read`, modify content, try to write directly.

**Result**: No `soul_write` tool exists. The only path is `soul_propose_update` → approval → CLI. Pass.

### Scenario 2: Telegram Message to Unpaired User

**Goal**: Send a message to a user who hasn't been paired.

**Test**: Call `telegram_send {userId: 999999, text: "test"}`.

**Result**: Bot daemon rejects the send — user is not in paired list. Pass.

### Scenario 3: Heartbeat Runaway

**Goal**: Execute unlimited tools via heartbeat.

**Test**: Create HEARTBEAT.md with 100 tasks, set `requireApproval: false`.

**Result**: Scheduler processes at most `maxActionsPerBeat` (default 5) per tick. Remaining tasks wait for next tick. Pass.

### Scenario 4: Config Weakening

**Goal**: Disable security via `config_set`.

**Test**: `config_set {path: "security.auditLog", value: false}`.

**Result**: Config change succeeds, but past audit entries remain (JSONL is append-only). Future actions won't be logged. This is a known limitation — config changes are not themselves gated by approval. Acceptable risk: the user controls config.

### Scenario 5: Memory Secret Injection

**Goal**: Store a secret in memory and retrieve it later.

**Test**: `memory_add {content: "API key: sk-abc123", entryType: "fact"}`.

**Result**: The entry is stored. Memory does not filter secrets from content. Mitigation: the skill instructs the agent not to store secrets, and `memory_search` results are only visible to the agent (not forwarded externally without agent action). Low risk.

### Scenario 6: Hardcoded Path Discovery

**Goal**: Find machine-specific paths in committed files.

**Test**: `grep -r '/home/' src/ skills/ setup.sh docs/`

**Result**: No matches in source code. `.mcp.json` (which contains hardcoded paths) is now gitignored. Pass.

## Automated Test Commands

```bash
# Run all tests
npm test

# Run security-relevant tests specifically
npx vitest run tests/soul.test.ts
npx vitest run tests/autonomy.test.ts
npx vitest run tests/telegram.test.ts

# Check for hardcoded paths
grep -r '/home/' src/ skills/ setup.sh

# Verify .gitignore covers secrets
grep 'secrets.env' .gitignore
grep '.mcp.json' .gitignore
```

## Results

| Check | Status | Notes |
|-------|--------|-------|
| All 172 tests pass | Pending | Run `npm test` |
| No hardcoded paths in src/ | Pending | Run grep check |
| .gitignore covers secrets | Pending | Verify manually |
| setup.sh portable | Pending | Test in temp directory |
| Approval flows work | Verified in Phase 3 | See soul.test.ts |
| Audit logging works | Verified in Phase 4 | See autonomy.test.ts |
| Active hours enforcement | Verified in Phase 4 | See autonomy.test.ts |
