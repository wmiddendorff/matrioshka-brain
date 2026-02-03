# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Universal Instructions (Apply to ALL Projects)

These instructions apply universally and should be followed regardless of project.

### PRD Handling

**PRDs are permanent artifacts.** They document decisions, architecture, and rationale - even failed approaches have learning value.

1. **Document completion separately**: Track progress in `PROGRESS.md`, not in the PRD itself. PRDs define requirements; progress files track execution.

2. **Stop and test at milestones**: At the end of each phase/milestone:
   - Stop implementation
   - Run all tests (automated + manual)
   - **Require human verification** before proceeding
   - Document test results in PROGRESS.md
   - Do NOT proceed to next phase without explicit approval

3. **Archive PRDs with dates**: When a PRD is completed or abandoned:
   - Rename with date prefix: `YYYY.MM.DD.PRDName.md`
   - Move to `docs/archive/` or project root
   - Never delete PRDs - they document decisions and learning
   - Example: `2026.02.02.PRD-v1-skill-first.md`

4. **Version PRDs during active development**:
   - Use `PRD.md` for current active version
   - Use `PRD-v2.md`, `PRD-v3.md` for major rewrites during comparison
   - Once decided, archive the rejected version with date prefix

### Milestone Testing Protocol

Before marking any phase complete:

```
[ ] All automated tests pass
[ ] Manual testing completed
[ ] Human verification obtained (explicit approval)
[ ] PROGRESS.md updated with results
[ ] Known issues documented
[ ] Ready for next phase (approved by human)
```

### Deliverables vs Scratch Work

- **Deliverables**: Permanent outputs (code, docs, configs). Never delete without asking.
- **Scratch/Temp**: Intermediate files, experiments, debugging. Disposable.
- When in doubt, ask before deleting anything.

### Guardrails (Learned Behaviors)

Document mistakes here to prevent repeating them. Keep under 15 items.

1. Always read a file before editing it
2. Never delete user files without explicit permission
3. Test at milestones - don't rush through phases
4. Archive PRDs, don't delete them
5. Use `~` or `$HOME` for paths, never hardcode `/home/username/...`
6. Secrets go in `.env` or `secrets.env`, never in code or git
7. **Update ALL docs when modifying code** - includes `docs/README.md` source tree, module status table, and all module-specific docs (README, API, IMPLEMENTATION, TESTING). Do this in the same task, not as an afterthought.

*(Add new guardrails as mistakes happen)*

### Continuous Improvement Loop

Every failure strengthens the system:

1. Identify what broke and why
2. Fix the immediate issue
3. Update documentation (CLAUDE.md, PRD, or code comments)
4. Add guardrail if it's a repeatable mistake
5. Next time → automatic success

---

## Project Overview

**Mudpuppy** 🐾 is a **more secure semi-clone** of OpenClaw, focusing on creating a fully autonomous AI agent that learns as it is used. Named after the aquatic salamander that never stops learning and evolving, Mudpuppy extends Claude Code directly with selected features from OpenClaw while prioritizing security and controlled autonomy.

## Core Features to Implement

### 1. Local Memory Persistence
- **Hybrid search system** combining vector embeddings and keyword search (SQLite + sqlite-vec + FTS)
- **File-based memory** using markdown files:
  - `MEMORY.md` for long-term curated knowledge
  - `memory/YYYY-MM-DD.md` for daily logs
  - Session transcripts in JSONL format
- **Philosophy**: "Text > Brain" - no mental notes, everything written to files
- Memory auto-syncing with file watchers
- Embedding batching with retry logic for resilience

**Atlas-agent improvements (adopted):**
- **Typed memory entries**: fact, preference, event, insight, task, relationship
- **Content hash deduplication**: SHA-256 hash prevents duplicate entries
- **Memory access logging**: Track retrieval patterns for analytics/pruning
- **Metadata fields**: confidence (0-1), importance (1-10), expiration dates
- **Tool manifests**: Document available tools in `tools/manifest.md`

### 2. Autonomous Execution
- **Cron scheduling system** with three types:
  - `at` (one-shot execution)
  - `every` (interval-based)
  - `cron` (5-field cron expressions)
- **Heartbeat mechanism** for periodic agent turns (configurable intervals)
- Active hours support (timezone-aware scheduling)
- Jobs persisted at `~/.mudpuppy/cron/jobs.json`
- Two execution modes: main session vs isolated sessions

### 3. Soul & Identity Separation
Critical conceptual framework for agent personality:

- **SOUL.md** - "Who You Are"
  - Core personality and behavioral guidelines
  - Communication style and boundaries
  - Evolves over time (agent can update it)

- **IDENTITY.md** - "Who Am I?"
  - Concrete identifiers: name, type, vibe, emoji, avatar
  - Metadata vs essence distinction

- **AGENTS.md** - "Your Workspace"
  - Operating instructions and safety rules
  - Memory protocols
  - External vs internal action guidelines

- **USER.md** - User profile information

- **BOOTSTRAP.md** - First-run initialization ritual (deleted after completion)

**Key Principle**: Identity = metadata/labels, Soul = behavioral essence. This separation allows consistent personality while changing identity details.

### 4. Telegram Integration
- Based on grammY library for Bot API
- DM pairing system (secure by default, privacy-first)
- Group chat support with mention gating
- HTML formatting (Telegram-safe subset)
- Draft streaming in DM threads
- Session isolation per group
- Multi-account capability

**Architecture (Phase 1.5 refactoring):**
- **MCP Tool + Skill Hybrid**: Telegram capabilities exposed as MCP tools, workflow defined in skill
- **Separation of concerns**:
  - **MCP Tool** = Capability (telegram_poll, telegram_send, telegram_pair, telegram_status)
  - **Skill** = Persona/workflow (what to do with messages, personality injection)
  - **Hook** = Trigger (auto-check messages on session start)
- **Tool manifest**: `~/.mudpuppy/tools/manifest.md` documents available tools

### 5. Tool Usage and Availability
- **Tool profiles**: minimal, coding, messaging, full
- **Tool groups**: runtime, fs, sessions, memory, web, ui, cron
- Policy-based filtering (allow/deny lists)
- Per-agent tool overrides
- Provider-specific restrictions
- Plugin SDK for extensibility

Key tool categories:
- Runtime: exec, bash, process management
- Filesystem: read, write, edit, patch
- Sessions: list, history, send, spawn
- Memory: search, get
- Messaging: cross-channel communication
- Cron: job management

### 6. File System Access
- **Workspace-centric design**: Primary workspace at `~/.mudpuppy/workspace`
- **Agent-specific directories**: `~/.mudpuppy/agents/<agentId>/`
- **Sandbox support** for isolation:
  - Docker-based sandboxing
  - Configurable access (none, ro, rw)
  - Per-session or per-agent scope
- Tool policy restricts filesystem operations
- Bootstrap files auto-injected per session

### 7. Agent Orchestration Layers
- **Multi-agent architecture** with per-agent configurations
- **Session management**:
  - Session scopes: per-sender, global, per-peer
  - Session keys: `agent:<agentId>:main`, `agent:<agentId>:<channel>:dm:<peer>`
  - Transcripts in JSONL format
- **Subagent system**:
  - Spawn isolated subagent sessions
  - Allowlist-based spawning controls
  - Cross-agent messaging capabilities
  - Announce/ping-pong communication
- **Queue modes**: steer (inject during streaming), followup (next turn), collect (batch)

### 8. Learning Mechanisms
- **File-based evolution**: Agents update their own bootstrap files (SOUL.md, AGENTS.md, MEMORY.md)
- **Continuous memory accumulation**: Daily logs + curated long-term memory
- **Hybrid memory search**: Automatic indexing of workspace and session transcripts
- **Session compaction**: Summarization to fit context windows
- **Hooks system**: Bootstrap hooks for behavior injection/override

## Security Considerations

This clone prioritizes security over feature parity with OpenClaw:

### Security Enhancements
1. **Strict tool policies** - Default deny with explicit allowlists
2. **Sandbox-first approach** - All non-main sessions run in Docker containers by default
3. **Approval flows** - Require explicit user approval for sensitive operations (exec, filesystem writes)
4. **Session isolation** - Hard boundaries between agent sessions
5. **DM pairing only** - No automatic group chat access without pairing
6. **Audit logging** - All tool executions logged with timestamps
7. **Rate limiting** - Prevent runaway autonomous execution
8. **Secret management** - Environment-based secrets, never in files
9. **Network restrictions** - Whitelist-based outbound network access in sandboxes
10. **Read-only by default** - Filesystem access defaults to read-only unless explicitly granted

### Threat Model
- **Autonomous agent risks**: Runaway execution, resource exhaustion, unintended actions
- **Memory poisoning**: Malicious content in memory files affecting future behavior
- **Privilege escalation**: Breaking out of sandboxes or session boundaries
- **Data exfiltration**: Sensitive information leaking through tool usage
- **Supply chain**: Third-party plugin security

## Architecture Principles

1. **Text > Brain**: All agent state persists in files, not just in-memory
2. **Privacy-first**: Local-first design, explicit opt-in for all integrations
3. **Deterministic routing**: Messages route back to source channel predictably
4. **Session isolation**: Each conversation context is independently scoped
5. **Extensibility**: Plugin architecture for custom tools and behaviors
6. **Fail-safe defaults**: Security restrictions by default, capabilities granted explicitly
7. **Observable autonomy**: All autonomous actions logged and auditable
8. **Graceful degradation**: System continues functioning when components fail

## Key Design Patterns

### Hub-and-Spoke Architecture
- **Gateway (Hub)**: WebSocket-based control plane at `ws://127.0.0.1:18789`
- **Channels**: Messaging integrations (Telegram, etc.)
- **Nodes**: Device-specific capabilities connecting via WebSocket
- **Agent Runtime**: Embedded agent system with tool streaming

### File-Based State Management
- Bootstrap files define agent behavior and memory
- Session transcripts provide conversation history
- Daily memory logs accumulate experience
- All state is human-readable and editable

### Controlled Autonomy
- Heartbeat for periodic self-initiated turns
- Cron for scheduled tasks
- Active hours to respect user time
- `HEARTBEAT_OK` token to suppress unnecessary responses
- Configurable delivery targets for autonomous messages

## Workspace Structure

```
~/.mudpuppy/
├── workspace/              # Main agent workspace
│   ├── SOUL.md            # Core personality (evolves)
│   ├── IDENTITY.md        # Agent identifiers
│   ├── AGENTS.md          # Operating instructions
│   ├── USER.md            # User profile
│   ├── MEMORY.md          # Curated long-term memory
│   ├── HEARTBEAT.md       # Periodic task list
│   ├── BOOTSTRAP.md       # First-run ritual (deleted after)
│   └── memory/            # Daily logs
│       └── YYYY-MM-DD.md
├── tools/                 # Tool documentation (atlas-agent pattern)
│   └── manifest.md        # Index of available tools
├── mcp-server/            # MCP server for tool definitions (Phase 1.5)
│   └── ...
├── agents/                # Per-agent data
│   └── <agentId>/
│       ├── sessions/      # Session transcripts (JSONL)
│       ├── memory.db      # SQLite + embeddings
│       └── ...
├── cron/
│   └── jobs.json         # Scheduled tasks
├── config.json           # Global configuration
├── secrets.env           # Environment secrets (gitignored)
├── telegram-queue.jsonl  # Incoming Telegram messages
└── telegram-responses.jsonl # Outgoing Telegram responses
```

## Integration Points with Claude Code

This project extends Claude Code by:
1. **Memory system**: Integrating hybrid search into Claude's context retrieval
2. **Autonomous mode**: Adding scheduled execution on top of interactive mode
3. **Persistent identity**: Bootstrap files defining Claude's evolving personality
4. **Multi-surface**: Enabling Claude to operate across Telegram and other channels
5. **Tool orchestration**: Enhanced tool system with policies and sandboxing
6. **Subagent spawning**: Claude can spawn and coordinate multiple agent sessions

## Current Project Files

**Planning & Documentation:**
- `CLAUDE.md` - This file, guidance for AI assistants
- `PRD.md` - Product Requirements Document with detailed specifications (v2 MCP-first)
- `PROGRESS.md` - Development progress tracker (UPDATE EVERY SESSION)
- `docs/` - Comprehensive module documentation (see docs/README.md)

**Implementation (v2 MCP-first architecture):**
- `src/index.ts` - Main exports
- `src/config.ts` - Configuration system
- `src/secrets.ts` - Secrets manager
- `src/mcp-server.ts` - MCP server entry point
- `src/cli/index.ts` - CLI commands (init, config, telegram, soul, heartbeat)
- `src/tools/index.ts` - Tool registry
- `src/tools/telegram.ts` - Telegram MCP tools (4 tools)
- `src/tools/memory.ts` - Memory MCP tools (5 tools)
- `src/tools/soul.ts` - Soul MCP tools (2 tools)
- `src/tools/heartbeat.ts` - Heartbeat MCP tools (3 tools)
- `src/telegram/` - Bot daemon, IPC, types, protocol
- `src/memory/` - Hybrid search, embeddings, daily log, indexer
- `src/approval/` - Generic approval system (SQLite)
- `src/soul/` - Templates, diff, file I/O
- `src/audit/` - JSONL audit logger
- `src/autonomy/` - Heartbeat scheduler, parser, types

**MCP Integration:**
- `.mcp.json` - MCP server configuration for Claude Code

**Documentation Status:**
- ✅ `docs/config/` - Complete (README, API, IMPLEMENTATION, TESTING)
- ✅ `docs/telegram/` - Complete (README, API, IMPLEMENTATION, TESTING)
- ✅ `docs/memory/` - Complete (README, API, IMPLEMENTATION, TESTING)
- ✅ `docs/soul/` - Complete (README, API, IMPLEMENTATION, TESTING)
- ✅ `docs/autonomy/` - Complete (README, API, IMPLEMENTATION, TESTING)
- ⬜ `docs/security/` - Not started (Phase 5)

**Status:** Phases 0-4 complete. Phase 5 (Skill Layer & Polish) next.

**Next Steps:**
1. Phase 5: Skill layer & polish
2. See PRD.md for detailed requirements

## Development Philosophy

- **Security over convenience**: When in doubt, restrict and require approval
- **Observability over opacity**: All actions should be traceable
- **Simplicity over features**: Only implement what's needed, resist feature creep
- **Files over databases**: Human-readable state when possible
- **Local-first**: No cloud dependencies for core functionality
- **Explicit over implicit**: No surprising behavior, clear user control

## Development Approach

### Test-Driven Development
- **Each phase must be fully tested** before moving to next phase
- **Human-in-the-loop validation** required for all features
- **No feature creep**: Complete current phase before starting next
- **Iterative refinement**: Requirements will be refined during implementation

### Progress Tracking
- **PROGRESS.md** maintains state across sessions
- Update PROGRESS.md at end of each work session
- Mark acceptance criteria as completed
- Log blockers and decisions
- Add notes for next session

### Documentation Requirements

**CRITICAL**: Documentation must be created and maintained alongside code, not after.

#### Documentation Structure

All documentation lives in `docs/` with module-specific folders:
- `docs/config/` - Configuration system
- `docs/memory/` - Memory persistence
- `docs/soul/` - Soul/Identity system
- `docs/autonomy/` - Heartbeat and cron
- `docs/telegram/` - Telegram integration
- `docs/tools/` - Agent tools
- `docs/security/` - Approval and audit systems
- `docs/architecture/` - Overall system design

#### Required Files Per Module

Each module directory must contain:

1. **README.md** - Overview, purpose, quick start guide
2. **API.md** - Public API documentation with examples
3. **IMPLEMENTATION.md** - Implementation details, design decisions, internals
4. **TESTING.md** - Testing strategy, test cases, coverage goals

Optional:
5. **DECISIONS.md** - Major architectural decisions and rationale (when significant)

#### Documentation Standards

**When to Write:**
- **During implementation** - Document as you build, not after
- **When adding features** - Update API.md with new interfaces
- **When making design decisions** - Log in IMPLEMENTATION.md or DECISIONS.md
- **When writing tests** - Document strategy in TESTING.md
- **Before phase completion** - Review and finalize all docs

**Writing Style:**
- Clear and concise
- Include runnable code examples
- Use diagrams where helpful (ASCII art acceptable)
- Link to related documentation
- Keep synchronized with code

**Code Examples:**
- Must be runnable (include imports)
- Show expected output
- Cover common use cases
- Demonstrate both CLI and programmatic usage

#### Documentation Checklist (Per Phase)

Before marking a phase complete:
- [ ] README.md exists and is comprehensive
- [ ] API.md documents all public interfaces
- [ ] IMPLEMENTATION.md explains design decisions
- [ ] TESTING.md covers test strategy and cases
- [ ] Code examples are tested and work
- [ ] Links to other docs are valid
- [ ] docs/README.md module status table updated

#### Example: Phase 0 Documentation

Phase 0 (Config) created:
- `docs/config/README.md` - Overview and quick start
- `docs/config/API.md` - CLI commands and ConfigManager API
- `docs/config/IMPLEMENTATION.md` - Design decisions, file format, error handling
- `docs/config/TESTING.md` - Test strategy, current tests, future coverage

See `docs/config/` for the complete example of proper documentation.

### Phase Execution Order

**IMPORTANT:** Phases must be completed in this order (v2 MCP-first architecture):

1. **Phase 0: Foundation** - MCP server skeleton, config, CLI 🔄 In Progress
2. **Phase 1: Telegram Tools** - telegram_poll, telegram_send, telegram_pair, telegram_status ⬜
3. **Phase 2: Memory Tools** - Hybrid search, knowledge accumulation ⬜
4. **Phase 3: Soul/Identity Tools** - Bootstrap files, personality persistence ⬜
5. **Phase 4: Autonomy** - Heartbeat, scheduled tasks ⬜
6. **Phase 5: Skill Layer & Polish** - Persona, documentation, security audit ⬜

**Rationale for Telegram-first:** Enables remote testing and async development workflow while away from house.

**Architecture:** MCP tools provide capabilities, optional skill layer provides persona/workflow.

### Session Workflow

**Starting a new session:**
1. Read PROGRESS.md to understand current state
2. Check current phase and acceptance criteria
3. Review notes from previous session
4. Continue from last checkpoint

**Ending a session:**
1. Update PROGRESS.md with accomplishments
2. Check off completed acceptance criteria
3. Add notes for next session
4. Log any decisions or blockers
5. Update phase status if complete

### Testing Requirements by Phase

**Phase 0 (Project Setup):**
- Manual: Run build, run tests, execute CLI
- Unit tests: Configuration loading
- Human validation: Review project structure

**Phase 1 (Telegram):**
- Manual: Send messages via Telegram, verify responses
- Integration: Full pairing flow from Telegram to local approval
- Edge cases: Invalid commands, rate limiting, bot restart
- Human validation: Use bot for 24 hours, verify stability

**Phase 2 (Soul & Identity):**
- Manual: First-run experience, personality consistency
- Unit tests: File loading, template rendering
- Integration: Edit SOUL.md manually, verify reload
- Human validation: Chat with agent over 3+ sessions, verify personality persists

**Phase 3 (Memory):**
- Unit tests: Search algorithm, embedding generation, database queries
- Integration: Add memories, search, verify results
- Performance: Load 10,000 entries, verify search speed <500ms
- Human validation: Use agent for 1 week, verify memory recall accuracy

**Phase 4 (Autonomy):**
- Unit tests: Parser, scheduler, task executor
- Integration: Full heartbeat cycle with approvals
- Edge cases: System restart, clock changes, concurrent sessions
- Security: Verify all risky actions require approval
- Human validation: Run for 48 hours, verify reliability

**Phase 5 (Security):**
- Security audit: Review all approval points
- Penetration test: Attempt to bypass approvals
- Stress test: High message volume, rapid approvals
- Human validation: Use as primary agent for 1 week
