# Mudpuppy v2 - Development Progress

**Last Updated:** 2026-02-02
**Architecture:** MCP-first
**Current Phase:** Phase 0 - Foundation
**Status:** Starting

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-02 | MCP-first architecture | Clean separation: tools=capabilities, skill=persona |
| 2026-02-02 | Telegram first (Phase 1) | Enables remote testing while away |
| 2026-02-02 | Local embeddings | Privacy-first, no API costs, using all-MiniLM-L6-v2 |
| 2026-02-02 | Unix socket for bot IPC | Fast, secure, standard for daemons |
| 2026-02-02 | Fresh start from v1 | v1 skill-first approach was messy, clean slate better |

---

## Phase Status Overview

| Phase | Status | Started | Completed |
|-------|--------|---------|-----------|
| Phase 0: Foundation | 🔄 In Progress | 2026-02-02 | - |
| Phase 1: Telegram Tools | ⬜ Not Started | - | - |
| Phase 2: Memory Tools | ⬜ Not Started | - | - |
| Phase 3: Soul/Identity Tools | ⬜ Not Started | - | - |
| Phase 4: Autonomy (Heartbeat) | ⬜ Not Started | - | - |
| Phase 5: Skill Layer & Polish | ⬜ Not Started | - | - |

---

## Phase 0: Foundation (MCP Server Skeleton)

**Status:** 🔄 In Progress
**Objective:** Create MCP server infrastructure and basic tooling.

### Acceptance Criteria

- [ ] MCP server starts and registers with Claude Code
- [ ] `mudpuppy init` creates workspace structure
- [ ] `mudpuppy config get/set` works
- [ ] Config loads from `~/.mudpuppy/config.json`
- [ ] All paths use `$MUDPUPPY_HOME` or `~`
- [ ] `npm run build` succeeds
- [ ] Basic tests pass

### Deliverables

- [ ] `src/mcp-server.ts` - MCP server entry point
- [ ] `src/config.ts` - Configuration manager
- [ ] `src/cli/index.ts` - CLI commands
- [ ] `src/tools/index.ts` - Tool registry

### Testing Checklist

- [ ] Unit: Config loading, path resolution
- [ ] Integration: MCP server registration
- [ ] Manual: CLI commands work
- [ ] **Human verification obtained**

---

## Phase 1: Telegram Tools

**Status:** ⬜ Not Started
**Objective:** Implement Telegram integration as MCP tools.

### Acceptance Criteria

- [ ] Bot starts as daemon via `mudpuppy telegram start`
- [ ] `telegram_poll` returns pending messages
- [ ] `telegram_send` delivers messages successfully
- [ ] `telegram_pair` triggers approval flow
- [ ] `telegram_status` returns accurate stats
- [ ] Messages from unpaired users are rejected
- [ ] Bot token stored securely (not in git)
- [ ] Bot survives restarts
- [ ] Unix socket IPC working

### Testing Checklist

- [ ] Unit: Each tool in isolation (mocked bot)
- [ ] Integration: Tool → Bot → Telegram roundtrip
- [ ] Manual: Send messages from phone, verify delivery
- [ ] **Human verification obtained**

---

## Phase 2: Memory Tools

**Status:** ⬜ Not Started
**Objective:** Implement memory persistence with hybrid search.

### Acceptance Criteria

- [ ] `memory_add` creates entries with all metadata
- [ ] Duplicate content returns existing entry (deduplication works)
- [ ] `memory_search` returns relevant results in <500ms
- [ ] Hybrid search combines vector + keyword scores
- [ ] Local embeddings working (all-MiniLM-L6-v2)
- [ ] Access logging records every retrieval
- [ ] `memory_stats` returns accurate statistics
- [ ] File changes auto-indexed
- [ ] Daily log created on first activity each day

### Testing Checklist

- [ ] Unit: Search algorithm, deduplication, scoring
- [ ] Integration: Add → Search → Verify
- [ ] Performance: 10,000 entries, verify speed <500ms
- [ ] Deduplication: Add same content twice
- [ ] **Human verification obtained**

---

## Phase 3: Soul/Identity Tools

**Status:** ⬜ Not Started
**Objective:** Implement personality persistence.

### Acceptance Criteria

- [ ] First run creates all bootstrap files
- [ ] `soul_read` returns file contents
- [ ] `soul_propose_update` creates pending approval
- [ ] Approval shows diff before accepting
- [ ] Manual file edits detected and respected
- [ ] Approval can be given via CLI

### Testing Checklist

- [ ] Unit: File loading, diff generation
- [ ] Integration: Propose → Approve → Verify update
- [ ] Manual: Edit SOUL.md manually, verify agent sees changes
- [ ] **Human verification obtained**

---

## Phase 4: Autonomy (Heartbeat)

**Status:** ⬜ Not Started
**Objective:** Implement periodic self-initiated execution.

### Acceptance Criteria

- [ ] Heartbeat triggers at configured interval
- [ ] Respects active hours configuration
- [ ] Parses unchecked tasks from HEARTBEAT.md
- [ ] Approval required for risky actions
- [ ] All actions logged to audit trail
- [ ] Pause/resume works via tools and CLI
- [ ] Telegram notification on completion (if configured)
- [ ] Failed heartbeat doesn't crash system

### Testing Checklist

- [ ] Unit: Parser, scheduler timing
- [ ] Integration: Full heartbeat cycle
- [ ] Edge cases: System restart, clock changes
- [ ] Security: Verify approval requirements
- [ ] **Human verification obtained**

---

## Phase 5: Skill Layer & Polish

**Status:** ⬜ Not Started
**Objective:** Add persona layer and finalize for production use.

### Acceptance Criteria

- [ ] Skill loads and works with MCP tools
- [ ] Personality consistent across sessions
- [ ] Setup script works on fresh machine
- [ ] Documentation complete
- [ ] No hardcoded paths
- [ ] Security audit passed
- [ ] Performance targets met

### Testing Checklist

- [ ] Manual: Full workflow testing
- [ ] Portability: Test on fresh VM
- [ ] Security: Penetration testing
- [ ] **Human verification: 1 week daily use**

---

## Session Log

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
