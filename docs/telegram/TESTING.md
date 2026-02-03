# Telegram Integration - Testing Strategy

## Test Coverage

- **Location**: `tests/telegram.test.ts`
- **Framework**: Vitest
- **Current status**: 28 tests, all passing

## Test Strategy

### Unit Tests (`tests/telegram.test.ts`)

Tests cover three areas:

1. **Secrets module**: Loading, saving, and managing bot tokens
2. **IPC protocol**: Request/response creation, parsing, serialization
3. **Type definitions**: Runtime structure verification

The bot daemon itself requires a real Telegram bot token and is tested manually.

### Why No Daemon Unit Tests?

The bot daemon (`bot.ts`) is tightly coupled to grammY and SQLite. Mocking grammY's Bot API would produce tests that don't verify real behavior. Instead:

- Protocol and types are tested in isolation (fast, deterministic)
- Daemon is tested via manual integration tests with a real bot

## Current Test Suite

### Secrets Module (12 tests)

**SecretsManager:**

| Test | Description |
|------|-------------|
| loads empty secrets when file does not exist | New manager has no keys |
| sets and gets secrets | `set()` + `get()` round-trip |
| saves secrets to file | Written to `secrets.env` in correct format |
| loads secrets from existing file | Reads pre-existing `secrets.env` |
| handles quoted values | Double and single quoted values parsed |
| ignores comments and empty lines | `#` lines and blank lines skipped |
| deletes secrets | `delete()` removes key, returns true |
| returns false when deleting non-existent secret | No-op returns false |
| quotes values with special characters when saving | Spaces trigger quoting |

**Helper functions:**

| Test | Description |
|------|-------------|
| getSecret returns undefined for missing key | Global helper |
| setSecret saves and persists | Global helper saves to disk |

### IPC Protocol (11 tests)

**createRequest:**

| Test | Description |
|------|-------------|
| creates a valid request with id and method | UUID and method set |
| includes params when provided | Optional params attached |

**createSuccessResponse / createErrorResponse:**

| Test | Description |
|------|-------------|
| creates a success response | `success: true`, result set |
| creates an error response | `success: false`, error set |

**parseRequest:**

| Test | Description |
|------|-------------|
| parses valid JSON request | Method + ID extracted |
| parses request with params | Params included |
| returns null for invalid JSON | Graceful failure |
| returns null for missing required fields | Missing id or method |

**parseResponse:**

| Test | Description |
|------|-------------|
| parses valid success response | Success + result |
| parses valid error response | Error + message |
| returns null for invalid/incomplete data | Graceful failure |

**serialize:**

| Test | Description |
|------|-------------|
| serializes request to JSON line | Ends with `\n`, valid JSON |
| serializes response to JSON line | Ends with `\n`, valid JSON |

### Telegram Types (3 tests)

| Test | Description |
|------|-------------|
| TelegramMessage type has correct structure | All fields accessible |
| BotStatus type has correct structure | Running + stats |
| BotStatus handles optional fields | Undefined optionals |

## Test Isolation

Tests use a unique temporary directory per run:

```typescript
const TEST_HOME = join(tmpdir(), `mudpuppy-test-telegram-${Date.now()}-${Math.random().toString(36).slice(2)}`);
process.env.MUDPUPPY_HOME = TEST_HOME;
```

Each test group cleans up with `rmSync(TEST_HOME, { recursive: true })` in `afterEach`.

## Manual Testing Checklist

### Bot Daemon

- [ ] `mudpuppy telegram start` starts daemon, prints PID
- [ ] `mudpuppy telegram status` shows running status
- [ ] `mudpuppy telegram stop` stops daemon cleanly
- [ ] `mudpuppy telegram restart` cycles the daemon
- [ ] Stale PID file detected and cleaned up
- [ ] Missing bot token produces clear error

### Pairing Flow

- [ ] User sends `/start` → receives welcome message
- [ ] Duplicate `/start` → "already pending" message
- [ ] Already paired user `/start` → "already paired" message
- [ ] `telegram_pair { action: "list" }` shows pending request
- [ ] `telegram_pair { action: "approve", userId: N }` approves
- [ ] User receives approval notification on Telegram
- [ ] `telegram_pair { action: "deny", userId: N }` denies
- [ ] User receives denial notification
- [ ] `telegram_pair { action: "revoke", userId: N }` removes pairing

### Message Flow

- [ ] Paired user sends message → queued with `read: 0`
- [ ] `telegram_poll {}` returns unread messages
- [ ] Messages marked as read after polling
- [ ] `telegram_poll { markAsRead: false }` preserves unread status
- [ ] `telegram_poll { userId: N }` filters by user
- [ ] `telegram_poll { limit: 1 }` respects limit
- [ ] `telegram_send { userId: N, text: "..." }` delivers message
- [ ] HTML formatting renders correctly
- [ ] Unpaired user message → "use /start" prompt

### Error Cases

- [ ] All tools return helpful hint when daemon not running
- [ ] Send to unpaired user → "User is not paired" error
- [ ] IPC timeout → clear error message
- [ ] Invalid pair action → descriptive error
- [ ] Missing userId for approve/deny → validation error

## Running Tests

```bash
# Run all tests
npm test

# Run telegram tests only
npx vitest run tests/telegram.test.ts

# Watch mode
npx vitest tests/telegram.test.ts
```

## Future Test Coverage

### Missing Unit Tests

1. Daemon lifecycle (startDaemon, stopDaemon) with mocked child_process
2. IPC client connection handling (timeout, error, close events)
3. isDaemonRunning with various PID file states
4. Socket server buffer handling (partial lines, multiple messages)

### Integration Tests

1. Full pairing flow: `/start` → approve → send message → poll
2. Daemon restart: messages preserved across restarts
3. Multiple concurrent IPC requests
4. Large message queue (1000+ messages) performance
5. Bot reconnection after network interruption

### Edge Cases

1. Very long messages (4096 char limit)
2. Unicode and emoji in messages
3. Rapid message sending (rate limiting)
4. Socket file permissions
5. Daemon crash recovery (stale PID, stale socket)
