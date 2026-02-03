# Autonomy Module - Testing Strategy

## Test File

All tests are in `tests/autonomy.test.ts`.

## Test Summary

**Total: 42 tests** across 7 describe blocks.

### Parser Tests (14 tests)

| Test | Description |
|------|-------------|
| empty document | Returns empty array |
| no tasks | Document with text but no checkboxes |
| unchecked tasks | Extracts `- [ ]` items |
| checked tasks skipped | `- [x]` items are ignored |
| @tool without args | Parses `@tool_name` → `{ tool, input: {} }` |
| @tool with JSON args | Parses `@tool_name {"key":"val"}` |
| malformed JSON | Treats as plain text (no toolCall) |
| plain text tasks | No toolCall property |
| recurring section | Detects `## Recurring` |
| one-time section | Detects `## One-time` |
| unknown section | Default for unrecognized headings |
| lineIndex tracking | Correct 0-based line indices |
| mixed sections | Full document with all section types |

### markTaskDone Tests (3 tests)

| Test | Description |
|------|-------------|
| replaces unchecked | `- [ ]` → `- [x]` at line index |
| out of range | Returns content unchanged |
| already checked | No double-checking |

### Active Hours Tests (5 tests)

| Test | Description |
|------|-------------|
| no config | Always returns true |
| during hours | Within configured range → true |
| outside hours | Outside range → false |
| midnight crossing | 22:00-06:00 handles wrap-around |
| timezone parameter | Accepts IANA timezone without throwing |

### Audit Logger Tests (5 tests)

| Test | Description |
|------|-------------|
| writes JSONL | Entry appended as single JSON line |
| appends multiple | Multiple entries on separate lines |
| recent entries | Returns newest first, respects limit |
| missing file | Returns empty array |
| creates directory | Auto-creates `data/` if missing |

### Scheduler Tests (12 tests)

| Test | Description |
|------|-------------|
| initial state | Correct defaults before start |
| start/stop | Toggles enabled and nextRun |
| pause/resume | Toggles paused state |
| tick when paused | Skips execution entirely |
| tick executes @tool | Calls executeTool, records result |
| tick skips plain text | Increments skipped counter |
| maxActionsPerBeat | Stops after limit reached |
| failed tool | Doesn't crash, records failure |
| marks one-time done | Updates file with `- [x]` |
| preserves recurring | Does NOT mark recurring tasks |
| writes audit log | Entries written to data/audit.log |
| updates lastRun | Timestamp set after tick |
| missing HEARTBEAT.md | Handles gracefully |

### Integration Tests (3 tests)

| Test | Description |
|------|-------------|
| full cycle | Parse → execute → audit → mark done |
| approval mode | Creates approval instead of executing |
| getState pending count | Reflects actual HEARTBEAT.md content |

## Test Isolation

- Each test uses a fresh temp directory (`mkdtempSync`)
- `MUDPUPPY_HOME` environment variable overridden per test
- Temp directories cleaned up in `afterEach`
- Approval tests use in-memory SQLite
- Scheduler instances stopped in cleanup

## What Is NOT Tested

- **Telegram notification** — Requires running bot daemon (integration test only)
- **Real timer execution** — Tests call `_tick()` directly instead of waiting for `setInterval`
- **Active hours with mocked time** — Tests use real `Date.now()` with computed ranges
- **Concurrent access** — JSONL append is atomic enough for single-process use

## Running Tests

```bash
# Run all tests
npm test

# Run only autonomy tests
npx vitest run tests/autonomy.test.ts

# Watch mode
npx vitest tests/autonomy.test.ts
```

## Coverage Goals

| Area | Target | Actual |
|------|--------|--------|
| Parser | 100% | ~100% |
| Active Hours | 90% | ~90% |
| Audit Logger | 100% | ~100% |
| Scheduler | 90% | ~90% |
| Integration | Key flows | 3 scenarios |
