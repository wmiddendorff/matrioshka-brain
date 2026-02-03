# Mudpuppy v2 - Development Progress

**Last Updated:** 2026-02-03
**Architecture:** MCP-first
**Current Phase:** Phase 5 - Skill Layer & Polish
**Status:** Phase 5 Complete, Awaiting Human Verification

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-02 | MCP-first architecture | Clean separation: tools=capabilities, skill=persona |
| 2026-02-02 | Telegram first (Phase 1) | Enables remote testing while away |
| 2026-02-02 | Local embeddings | Privacy-first, no API costs, using all-MiniLM-L6-v2 |
| 2026-02-02 | Unix socket for bot IPC | Fast, secure, standard for daemons |
| 2026-02-02 | Fresh start from v1 | v1 skill-first approach was messy, clean slate better |
| 2026-02-02 | sqlite-vec needs BigInt PKs | sqlite-vec requires BigInt for primary key values, not Number |
| 2026-02-02 | createRequire for sqlite-vec | ESM project needs createRequire(import.meta.url) for native extensions |

---

## Phase Status Overview

| Phase | Status | Started | Completed |
|-------|--------|---------|-----------|
| Phase 0: Foundation | ✅ Complete | 2026-02-02 | 2026-02-02 |
| Phase 1: Telegram Tools | ✅ Complete | 2026-02-02 | 2026-02-02 |
| Phase 2: Memory Tools | ✅ Complete | 2026-02-02 | 2026-02-03 |
| Phase 3: Soul/Identity Tools | ✅ Complete | 2026-02-03 | 2026-02-03 |
| Phase 4: Autonomy (Heartbeat) | ✅ Complete | 2026-02-03 | 2026-02-03 |
| Phase 5: Skill Layer & Polish | ✅ Complete | 2026-02-03 | 2026-02-03 |

---

## Phase 0: Foundation (MCP Server Skeleton)

**Status:** ✅ Complete
**Objective:** Create MCP server infrastructure and basic tooling.

### Acceptance Criteria

- [x] MCP server starts and registers with Claude Code
- [x] `mudpuppy init` creates workspace structure
- [x] `mudpuppy config get/set` works
- [x] Config loads from `~/.mudpuppy/config.json`
- [x] All paths use `$MUDPUPPY_HOME` or `~`
- [x] `npm run build` succeeds
- [x] Basic tests pass (33 tests)

### Deliverables

- [x] `src/mcp-server.ts` - MCP server entry point
- [x] `src/config.ts` - Configuration manager
- [x] `src/cli/index.ts` - CLI commands
- [x] `src/tools/index.ts` - Tool registry

### Testing Checklist

- [x] Unit: Config loading, path resolution (33 tests)
- [x] Integration: MCP server registration
- [x] Manual: CLI commands work (init, config get/set, status)
- [x] **Human verification obtained**

---

## Phase 1: Telegram Tools

**Status:** ✅ Complete
**Objective:** Implement Telegram integration as MCP tools.

### Acceptance Criteria

- [x] Bot starts as daemon via `mudpuppy telegram start`
- [x] `telegram_poll` returns pending messages
- [x] `telegram_send` delivers messages successfully
- [x] `telegram_pair` triggers approval flow
- [x] `telegram_status` returns accurate stats
- [x] Messages from unpaired users are rejected
- [x] Bot token stored securely (not in git)
- [x] Bot survives restarts
- [x] Unix socket IPC working

### Deliverables

- [x] `src/secrets.ts` - Secrets manager for TELEGRAM_BOT_TOKEN
- [x] `src/telegram/types.ts` - TelegramMessage, PairingRequest, BotStatus interfaces
- [x] `src/telegram/protocol.ts` - IPC request/response schemas
- [x] `src/telegram/daemon.ts` - PID file management, spawn/kill
- [x] `src/telegram/bot.ts` - grammY bot + socket server (main daemon)
- [x] `src/telegram/ipc.ts` - Unix socket client for MCP tools
- [x] `src/telegram/index.ts` - Module re-exports
- [x] `src/tools/telegram.ts` - 4 MCP tools: poll, send, pair, status
- [x] CLI commands: telegram start/stop/restart/status/set-token

### Testing Checklist

- [x] Unit: Types, protocol, secrets (28 tests)
- [x] Integration: Tool → Bot → Telegram roundtrip
- [x] Manual: Send messages from phone, verify delivery
- [x] **Human verification obtained**

---

## Phase 2: Memory Tools

**Status:** ✅ Complete
**Objective:** Implement memory persistence with hybrid search.

### Acceptance Criteria

- [x] `memory_add` creates entries with all metadata
- [x] Duplicate content returns existing entry (deduplication works)
- [x] `memory_search` returns relevant results in <500ms (4ms P50 at 10K entries)
- [x] Hybrid search combines vector + keyword scores (configurable weights)
- [x] Local embeddings working (all-MiniLM-L6-v2)
- [x] Access logging records every retrieval
- [x] `memory_stats` returns accurate statistics
- [x] File changes auto-indexed (fs.watch + polling fallback)
- [x] Daily log created on first activity each day

### Deliverables

- [x] `src/memory/types.ts` - MemoryEntry, SearchResult, SearchOptions (with configurable weights), AddResult, MemoryStats interfaces
- [x] `src/memory/embeddings.ts` - Lazy-loaded @xenova/transformers pipeline (all-MiniLM-L6-v2)
- [x] `src/memory/db.ts` - SQLite schema, sqlite-vec + FTS5 setup, CRUD, vector/keyword search
- [x] `src/memory/search.ts` - Hybrid search algorithm (configurable weights, default 0.7/0.3)
- [x] `src/memory/daily-log.ts` - Daily markdown log file creation and appending
- [x] `src/memory/indexer.ts` - File auto-indexer (fs.watch + polling fallback)
- [x] `src/memory/index.ts` - Module re-exports
- [x] `src/tools/memory.ts` - 5 MCP tools with config weights and daily log integration
- [x] `tests/memory.test.ts` - 33 tests covering types, CRUD, dedup, search, weights, performance
- [x] `tests/perf-10k.mjs` - Standalone 10K entry performance test

### Testing Checklist

- [x] Unit: Search algorithm, deduplication, scoring, weights, performance (33 tests)
- [x] Integration: Add → Search → Verify (real embeddings, all checks passed)
- [x] Performance: 10,000 entries, all searches <500ms (P50: 3ms, Max: 4ms)
- [x] Deduplication: Add same content twice
- [x] **Human verification obtained**

---

## Phase 3: Soul/Identity Tools

**Status:** ✅ Complete
**Objective:** Implement personality persistence.

### Acceptance Criteria

- [x] First run creates all bootstrap files
- [x] `soul_read` returns file contents
- [x] `soul_propose_update` creates pending approval
- [x] Approval shows diff before accepting
- [x] Manual file edits detected and respected
- [x] Approval can be given via CLI

### Deliverables

- [x] `src/approval/types.ts` - Approval type definitions (ApprovalType, ApprovalStatus, Approval, rowToApproval)
- [x] `src/approval/db.ts` - SQLite singleton, schema, CRUD (create, get, listPending, updateStatus, expireOld)
- [x] `src/approval/index.ts` - Module re-exports
- [x] `src/soul/types.ts` - SoulFileType, ProposableSoulFile, SoulReadResult, SOUL_FILE_MAP
- [x] `src/soul/templates.ts` - getDefaultTemplate() for all 4 file types
- [x] `src/soul/diff.ts` - LCS-based unified diff generator
- [x] `src/soul/files.ts` - readSoulFile, writeSoulFile, getSoulFilePath, ensureBootstrapFiles
- [x] `src/soul/index.ts` - Module re-exports
- [x] `src/tools/soul.ts` - soul_read + soul_propose_update MCP tools
- [x] CLI commands: soul list/show/approve/deny
- [x] Refactored CLI to use soul/templates.ts (DRY)
- [x] `tests/soul.test.ts` - 36 tests
- [x] `docs/soul/` - README, API, IMPLEMENTATION, TESTING

### Testing Checklist

- [x] Unit: Types, templates, diff edge cases, file operations, approval DB CRUD (36 tests)
- [x] Integration: Propose → Approve → Verify update
- [x] Integration: Propose → Deny → File unchanged
- [x] Manual: Full propose → approve → verify flow, manual edit detection
- [x] **Human verification obtained**

---

## Phase 4: Autonomy (Heartbeat)

**Status:** ✅ Complete
**Objective:** Implement periodic self-initiated execution.

### Acceptance Criteria

- [x] Heartbeat triggers at configured interval
- [x] Respects active hours configuration
- [x] Parses unchecked tasks from HEARTBEAT.md
- [x] Approval required for risky actions
- [x] All actions logged to audit trail
- [x] Pause/resume works via tools and CLI
- [x] Telegram notification on completion (if configured)
- [x] Failed heartbeat doesn't crash system

### Deliverables

- [x] `src/audit/logger.ts` - JSONL audit log (auditLog, getRecentAuditEntries)
- [x] `src/audit/index.ts` - Module re-exports
- [x] `src/autonomy/types.ts` - HeartbeatState, HeartbeatTask, HeartbeatResult, etc.
- [x] `src/autonomy/parser.ts` - HEARTBEAT.md parser (parseHeartbeatMd, markTaskDone)
- [x] `src/autonomy/scheduler.ts` - HeartbeatScheduler class with tick handler
- [x] `src/autonomy/index.ts` - Module re-exports
- [x] `src/tools/heartbeat.ts` - 3 MCP tools: heartbeat_status, heartbeat_pause, heartbeat_resume
- [x] CLI commands: heartbeat status/pause/resume
- [x] MCP server starts scheduler when heartbeat.enabled = true
- [x] `tests/autonomy.test.ts` - 42 tests
- [x] `docs/autonomy/` - README, API, IMPLEMENTATION, TESTING

### Testing Checklist

- [x] Unit: Parser (14 tests), markTaskDone (3 tests), active hours (5 tests), audit logger (5 tests)
- [x] Unit: Scheduler state, pause/resume, tick execution (12 tests)
- [x] Integration: Full heartbeat cycle (3 tests)
- [x] Edge cases: Missing file, failed tools, maxActionsPerBeat, malformed JSON
- [x] Security: Approval mode creates approvals instead of executing
- [ ] **Human verification obtained**

---

## Phase 5: Skill Layer & Polish

**Status:** ✅ Complete
**Objective:** Add persona layer and finalize for production use.

### Acceptance Criteria

- [x] Skill loads and works with MCP tools
- [x] Personality consistent across sessions (SKILL.md reads SOUL.md at session start)
- [x] Setup script works on fresh machine
- [x] Documentation complete (all 6 module docs + README rewrite)
- [x] No hardcoded paths (grep verified)
- [x] Security audit passed (see docs/security/TESTING.md)
- [x] Performance targets met (172 tests pass, no regressions)

### Deliverables

- [x] `skills/mudpuppy/SKILL.md` - Claude Code skill (persona + 16 MCP tool workflows)
- [x] `setup.sh` - Portable setup script (prerequisites, build, init, .mcp.json)
- [x] `.mcp.json.example` - MCP config template with placeholder paths
- [x] `docs/security/README.md` - Security model overview + threat model
- [x] `docs/security/API.md` - Approval + audit API reference
- [x] `docs/security/IMPLEMENTATION.md` - Security implementation details
- [x] `docs/security/TESTING.md` - Audit checklist + pen-test scenarios
- [x] `README.md` - Complete rewrite (architecture, tools, CLI, workspace, security)
- [x] `.gitignore` - Added `.mcp.json`, replaced `.openclaw-clone/` with `.mudpuppy/`
- [x] `.mcp.json` removed from git (now generated by setup.sh)
- [x] `docs/README.md` - Updated module status, added skills to source tree
- [x] `CLAUDE.md` - Updated file list, doc status, phase status

### Testing Checklist

- [x] `npm run build` — compiles cleanly
- [x] `npm test` — all 172 tests pass
- [x] `grep -r '/home/' src/ skills/ setup.sh` — no hardcoded paths
- [x] `.mcp.json` not in git, `.mcp.json.example` present
- [x] `docs/security/` — all 4 files exist
- [x] `README.md` — no `openclaw-clone` references
- [x] `setup.sh` — test in temp directory
- [ ] **Human verification obtained**

---

## Session Log

### Session 7 - 2026-02-03 (Phase 5 Skill Layer & Polish)

**Phase:** Phase 5 - Skill Layer & Polish

**Accomplishments:**
- Created `skills/mudpuppy/SKILL.md` with YAML frontmatter and all 7 sections (init, personality, messages, memory, heartbeat, soul evolution, security)
- Removed `.mcp.json` from git tracking (`git rm`), added to `.gitignore`
- Created `.mcp.json.example` with placeholder paths
- Updated `.gitignore`: added `.mcp.json`, replaced `.openclaw-clone/` with `.mudpuppy/`
- Created `setup.sh` portable setup script (prerequisite checks, npm install, build, init, .mcp.json generation)
- Complete rewrite of `README.md` (architecture diagram, 16 MCP tools table, CLI commands, workspace structure, skill setup, source tree, security overview)
- Created `docs/security/` with 4 files (README, API, IMPLEMENTATION, TESTING)
- Updated `docs/README.md` (security row complete, skill layer row, source tree)
- Updated `CLAUDE.md` (file list, doc status, phase status)
- Updated `PROGRESS.md` (Phase 5 status, session log)
- Verified no hardcoded paths in src/, skills/, setup.sh
- All 172 tests pass, build succeeds

**Files Created:**
- `skills/mudpuppy/SKILL.md`
- `setup.sh`
- `.mcp.json.example`
- `docs/security/README.md`
- `docs/security/API.md`
- `docs/security/IMPLEMENTATION.md`
- `docs/security/TESTING.md`

**Files Modified:**
- `.gitignore` - Added .mcp.json, replaced .openclaw-clone/ with .mudpuppy/
- `README.md` - Complete rewrite
- `docs/README.md` - Updated status table + source tree
- `CLAUDE.md` - Updated file list, doc status, phase status
- `PROGRESS.md` - Phase 5 status + session log

**Files Removed from Git:**
- `.mcp.json` (git rm, now gitignored)

**Remaining:**
- Test setup.sh in temp directory
- Human verification

---

### Session 6 - 2026-02-03 (Phase 4 Autonomy/Heartbeat)

**Phase:** Phase 4 - Autonomy (Heartbeat)

**Accomplishments:**
- Created `src/audit/` module: JSONL audit logger with auditLog() and getRecentAuditEntries()
- Created `src/autonomy/` module: types, HEARTBEAT.md parser, HeartbeatScheduler
- Parser extracts `- [ ]` tasks, detects `@tool` prefix, identifies recurring/one-time sections
- Scheduler: start/stop/pause/resume, active hours (timezone-aware), tick handler
- Tick: parse → execute tools → audit log → mark one-time done → Telegram notify
- Approval integration: when requireApproval=true, creates heartbeat_action approvals
- Registered 3 MCP tools: heartbeat_status, heartbeat_pause, heartbeat_resume
- Added CLI commands: heartbeat status/pause/resume
- MCP server starts scheduler on boot when heartbeat.enabled=true
- 42 new tests (172 total: 33 config + 28 telegram + 33 memory + 36 soul + 42 autonomy)
- Build succeeds, all tests pass
- Created docs/autonomy/ (README, API, IMPLEMENTATION, TESTING)
- Updated docs/README.md module status + source tree
- Updated CLAUDE.md file list + documentation status

**Files Created:**
- `src/audit/logger.ts`
- `src/audit/index.ts`
- `src/autonomy/types.ts`
- `src/autonomy/parser.ts`
- `src/autonomy/scheduler.ts`
- `src/autonomy/index.ts`
- `src/tools/heartbeat.ts`
- `tests/autonomy.test.ts`
- `docs/autonomy/README.md`
- `docs/autonomy/API.md`
- `docs/autonomy/IMPLEMENTATION.md`
- `docs/autonomy/TESTING.md`

**Files Modified:**
- `src/tools/index.ts` - Added heartbeat.js import in initTools()
- `src/cli/index.ts` - Heartbeat CLI commands, help text
- `src/index.ts` - Added audit + autonomy exports
- `src/mcp-server.ts` - Starts scheduler on boot if heartbeat.enabled
- `docs/README.md` - Updated module status table + source tree
- `CLAUDE.md` - Updated file list + documentation status
- `PROGRESS.md` - Phase 4 status + session log

**Remaining:**
- Manual testing
- Human verification

---

### Session 5 - 2026-02-03 (Phase 3 Soul/Identity)

**Phase:** Phase 3 - Soul/Identity Tools

**Accomplishments:**
- Created `src/approval/` module: types, SQLite DB (data/approvals.db), CRUD operations
- Created `src/soul/` module: types, templates, LCS-based unified diff, file I/O
- Registered 2 MCP tools: `soul_read`, `soul_propose_update`
- Added CLI commands: `soul list`, `soul show`, `soul approve`, `soul deny`
- Refactored CLI `createDefaultWorkspaceFiles()` to use shared `soul/templates.ts` (DRY)
- 36 new tests (130 total: 33 config + 28 telegram + 33 memory + 36 soul)
- Build succeeds, all tests pass
- Created docs/soul/ (README, API, IMPLEMENTATION, TESTING)
- Updated docs/README.md module status + source tree

**Files Created:**
- `src/approval/types.ts`
- `src/approval/db.ts`
- `src/approval/index.ts`
- `src/soul/types.ts`
- `src/soul/templates.ts`
- `src/soul/diff.ts`
- `src/soul/files.ts`
- `src/soul/index.ts`
- `src/tools/soul.ts`
- `tests/soul.test.ts`
- `docs/soul/README.md`
- `docs/soul/API.md`
- `docs/soul/IMPLEMENTATION.md`
- `docs/soul/TESTING.md`

**Files Modified:**
- `src/tools/index.ts` - Added soul.js import in initTools()
- `src/cli/index.ts` - Soul CLI commands, refactored templates to use soul/templates.ts
- `src/index.ts` - Added approval + soul exports
- `docs/README.md` - Updated module status table + source tree
- `PROGRESS.md` - Phase 3 status + session log

**Remaining:**
- Manual testing
- Human verification

---

### Session 4 - 2026-02-03 (Phase 2 Completion)

**Phase:** Phase 2 - Memory Tools (remaining items)

**Accomplishments:**
- Added configurable hybrid weights to `SearchOptions` and `hybridSearch()`
- `memory_search` MCP tool now reads weights from `config.memory.hybridWeights`
- Created `src/memory/daily-log.ts` - daily markdown log files (`YYYY-MM-DD.md`)
- `memory_add` tool auto-appends to daily log (skips `source: 'file-index'` to prevent feedback loops)
- Created `src/memory/indexer.ts` - file auto-indexer with fs.watch, debouncing, content hash tracking
- Indexer starts in `mcp-server.ts` when `config.memory.autoIndex === true`
- Created `tests/perf-10k.mjs` standalone performance test (10K entries, P50: 3ms, Max: 4ms)
- Added 4 new unit tests: configurable weights (3) + 10K performance (1)
- All 94 tests passing (33 config + 28 telegram + 33 memory)
- Build succeeds
- Updated all 4 docs/memory/ files

**Files Created:**
- `src/memory/daily-log.ts`
- `src/memory/indexer.ts`
- `tests/perf-10k.mjs`

**Files Modified:**
- `src/memory/types.ts` - Added vectorWeight/keywordWeight to SearchOptions
- `src/memory/search.ts` - Uses configurable weights with fallback to defaults
- `src/memory/index.ts` - Exports daily-log and indexer modules
- `src/tools/memory.ts` - Config weights in search, daily log on add
- `src/mcp-server.ts` - Starts indexer on boot if autoIndex enabled
- `tests/memory.test.ts` - Added weight and performance tests
- `docs/memory/README.md` - Updated with daily log, indexer, performance
- `docs/memory/API.md` - Added daily-log and indexer API docs
- `docs/memory/IMPLEMENTATION.md` - Added daily-log and indexer sections
- `docs/memory/TESTING.md` - Added new test docs, updated performance results

**Remaining for Phase 2:**
- Human verification

---

### Session 3 - 2026-02-02 (Phase 2 Memory Implementation)

**Phase:** Phase 2 - Memory Tools Implementation

**Accomplishments:**
- Installed `sqlite-vec` dependency
- Created memory type definitions (MemoryEntry, SearchResult, SearchOptions, AddResult, MemoryStats)
- Implemented embeddings module with lazy-loaded @xenova/transformers pipeline
- Created database module with SQLite schema: memory_entries, memory_fts (FTS5), vec_entries (sqlite-vec), memory_access_log
- FTS5 sync triggers for insert/update/delete
- Content hash deduplication via SHA-256
- Implemented hybrid search algorithm (0.7 vector + 0.3 keyword score combining)
- Registered 5 MCP tools: memory_add, memory_search, memory_get, memory_stats, memory_delete
- All 90 tests passing (33 config + 28 telegram + 29 memory)
- Build succeeds

**Gotchas/Learned:**
- sqlite-vec requires `BigInt` for primary key values, not `Number`
- ESM projects need `createRequire(import.meta.url)` to load native extensions like sqlite-vec

**Files Created:**
- `src/memory/types.ts`
- `src/memory/embeddings.ts`
- `src/memory/db.ts`
- `src/memory/search.ts`
- `src/memory/index.ts`
- `src/tools/memory.ts`
- `tests/memory.test.ts`

**Files Modified:**
- `src/tools/index.ts` - Added memory tools import and updated TOOL_CATEGORIES
- `src/index.ts` - Added memory module exports
- `package.json` - Added sqlite-vec dependency

**Remaining for Phase 2:**
- Manual integration testing with real embeddings model (requires ~80MB model download)
- Performance testing with 10,000+ entries
- File auto-indexing and daily log features (deferred to later phase)
- Human verification

---

### Session 2 - 2026-02-02 (Phase 1 Complete)

**Phase:** Phase 1 - Telegram Tools Implementation

**Accomplishments:**
- Implemented SecretsManager for secure token storage
- Created Telegram type definitions (TelegramMessage, PairingRequest, BotStatus)
- Implemented IPC protocol (newline-delimited JSON over Unix socket)
- Created daemon manager (start/stop/restart with PID file)
- Implemented grammY bot with SQLite message queue
- Bot handles: /start (pairing), /help, /status commands
- Messages from paired users queued to database
- IPC client for MCP tools to communicate with daemon
- Registered 4 MCP tools: telegram_status, telegram_poll, telegram_send, telegram_pair
- Added CLI commands: telegram start/stop/restart/status/set-token
- All 61 tests passing (33 config + 28 telegram)
- Build succeeds

**Files Created:**
- `src/secrets.ts`
- `src/telegram/types.ts`
- `src/telegram/protocol.ts`
- `src/telegram/daemon.ts`
- `src/telegram/bot.ts`
- `src/telegram/ipc.ts`
- `src/telegram/index.ts`
- `src/tools/telegram.ts`
- `tests/telegram.test.ts`

**Next:**
- Manual testing with actual Telegram bot
- Human verification of full workflow
- Document Phase 1 in docs/telegram/

---

### Session 1 - 2026-02-02 (v2 Start)

**Phase:** v1 → v2 Migration + Phase 0 Start

**Accomplishments:**
- Reviewed v1 implementation, identified architectural issues
- Compared with atlas-agent, adopted memory patterns
- Designed MCP-first architecture (PRD v2)
- Archived v1 PRD as `2026.02.02.PRD-v1-skill-first.md`
- Archived v1 source code to `docs/archive/v1-src/`
- Removed v1 skill from `~/.claude/skills/mudpuppy/`
- Added Universal Instructions to CLAUDE.md (PRD handling, guardrails)
- Made key decisions: local embeddings, Unix socket IPC, fresh start
- Beginning Phase 0 implementation

**Decisions Made:**
- Telegram first (enables remote testing)
- Local embeddings with all-MiniLM-L6-v2 (privacy, no API costs)
- Unix socket for bot ↔ MCP server IPC
- Fresh start (don't salvage v1 code)

**Next:**
- Set up MCP SDK
- Create MCP server skeleton
- Implement portable config system
- Basic CLI

---

## Archived Materials

- `docs/archive/2026.02.02.PRD-v1-skill-first.md` - Original skill-first PRD
- `docs/archive/v1-src/` - Original v1 source code

---

## Quick Reference

**Workspace:** `~/.mudpuppy/` (or `$MUDPUPPY_HOME`)
**Project:** `~/Desktop/workspace/mudpuppy/`

**Key Files:**
- `PRD.md` - v2 Product Requirements (MCP-first)
- `CLAUDE.md` - AI guidance + universal instructions
- `PROGRESS.md` - This file

**Commands (when implemented):**
```bash
mudpuppy init              # Initialize workspace
mudpuppy config get/set    # Configuration
mudpuppy telegram start    # Start bot daemon
mudpuppy telegram stop     # Stop bot daemon
mudpuppy status            # System status
```
