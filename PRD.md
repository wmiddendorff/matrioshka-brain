# Product Requirements Document: Mudpuppy

**Version:** 1.0
**Date:** 2026-02-02
**Status:** Draft
**Author:** AI-assisted with user input

## Executive Summary

Mudpuppy is a **security-hardened autonomous AI agent** built as a **Claude Code skill**, designed to provide persistent memory, evolving personality, and controlled autonomous execution. The project extends Claude Code with Telegram integration, allowing bidirectional remote control while using your existing Claude subscription (not API). It runs side-by-side with the existing OpenClaw installation, offering a more secure architecture with approval-first execution model while maintaining compatibility with OpenClaw's file-based memory and identity concepts.

**Key Architectural Decision:** Mudpuppy is built as a Claude Code skill rather than a standalone agent, enabling use of your Claude.ai subscription instead of API tokens, while providing full remote control via Telegram.

## Vision Statement

Create a fully autonomous AI agent that learns and evolves through use, extending Claude Code with:
- **Persistent memory** that accumulates knowledge over time
- **Consistent identity** through the Soul/Identity separation framework
- **Controlled autonomy** via heartbeat and cron scheduling with security-first design
- **Multi-surface presence** starting with Telegram integration
- **Human-readable state** through file-based architecture

## Goals & Non-Goals

### Goals
1. **Security-first autonomy**: Enable autonomous execution without compromising user control or system safety
2. **Learning agent**: Build genuine knowledge accumulation through hybrid search memory system
3. **Persistent identity**: Implement evolving personality through Soul/Identity framework
4. **Extensible platform**: Create plugin architecture that extends Claude Code cleanly
5. **Multi-purpose utility**: Support personal assistant, development companion, research assistant, and general automation use cases

### Non-Goals
1. **Not a cloud service**: No multi-tenant SaaS deployment, single-user only
2. **Not replacing OpenClaw**: Runs side-by-side, no migration of existing OpenClaw data required
3. **Not feature parity**: Selective implementation of OpenClaw features with security focus
4. **Not modifying Claude Code core**: Plugin-based extension, no core code changes

## User Personas

### Primary: Power User / Developer
- Runs both OpenClaw and Mudpuppy
- Comfortable with command line and configuration files
- Values security, privacy, and transparency
- Wants autonomous assistance without losing control
- Uses agent across multiple contexts: coding, research, personal tasks

### Use Cases
1. **Personal Assistant**: Task management, reminders, information lookup, daily automation
2. **Development Companion**: Code review, testing, documentation, bug tracking
3. **Research Assistant**: Information gathering, synthesis, note-taking, knowledge management
4. **General Automation**: File operations, web scraping, data processing, scheduled tasks

## Product Overview

### Core Architecture

**Deployment Model:** Single-user local machine
**Extension Method:** Claude Code skill (loaded alongside Claude CLI)
**LLM Integration:** Uses existing Claude Code subscription (NOT Anthropic API)
**Security Model:** Approval-first (all autonomous actions require pre-approval or run read-only)
**Technology Stack:** TypeScript/Node.js
**Workspace Location:** `~/.mudpuppy/`

**Key Insight:** By building as a Claude Code skill, Mudpuppy uses your existing Claude subscription, stays ToS-compliant, and enables full bidirectional control via Telegram.

### System Components

```
┌─────────────────────────────────────────────────────┐
│   You (via CLI or Telegram)                        │
└─────────────┬───────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────┐
│   Claude Code CLI (Your Claude.ai Subscription)    │
│   Active session running "claude" command          │
└─────────────┬───────────────────────────────────────┘
              │ Loads skill
┌─────────────▼───────────────────────────────────────┐
│          Mudpuppy Skill                             │
│  ┌────────────┐ ┌────────────┐ ┌─────────────┐    │
│  │  Memory    │ │   Soul/    │ │  Autonomy   │    │
│  │  System    │ │  Identity  │ │  Engine     │    │
│  └────────────┘ └────────────┘ └─────────────┘    │
│  ┌────────────┐ ┌────────────┐ ┌─────────────┐    │
│  │  Telegram  │ │   Message  │ │  Approval   │    │
│  │  Bridge    │ │  Router    │ │  Manager    │    │
│  └──────┬─────┘ └────────────┘ └─────────────┘    │
└─────────┼───────────────────────────────────────────┘
          │ Bidirectional
┌─────────▼───────────────────────────────────────────┐
│  Telegram API (Remote Control Interface)           │
│  • Send messages/commands to Claude                │
│  • Receive Claude's responses                      │
│  • Give/deny approvals remotely                    │
│  • Issue commands (/status, /pause, etc)           │
└─────────────────────────────────────────────────────┘

Message Flow:
  Telegram → Mudpuppy → Claude Code → Response → Telegram
  Local CLI → Claude Code → Response → Local CLI
  Approval → Sent to BOTH Telegram AND CLI → Approved from either
```

## Claude Code Skill Architecture

### Why a Skill?

**ToS Compliance:** Using the Anthropic API would cost per token. Building as a Claude Code skill allows use of your existing Claude.ai subscription while staying compliant with terms of service.

**How It Works:**
1. You run `claude` (normal Claude Code CLI)
2. Mudpuppy skill loads automatically in background
3. Telegram messages route through your active Claude session
4. Claude responds using your subscription
5. Responses route back to Telegram
6. You can interact from EITHER CLI or Telegram

### Skill Integration Points

**Loaded at startup:**
- Mudpuppy skill registers with Claude Code
- Telegram bot starts listening
- Memory system initializes
- Soul/Identity files loaded into context

**Message routing:**
- Incoming Telegram → Appears in Claude session as user message
- Claude processes (you see it in your terminal)
- Response → Routes back to Telegram user
- CLI messages → Normal Claude Code behavior

**Bidirectional control:**
- Send commands via Telegram: `/status`, `/pause`, etc.
- Give approvals via Telegram when away from computer
- Everything logged and visible in CLI too

### Skill Capabilities

Unlike a standalone agent, the skill:
- ✅ Uses your Claude subscription (not API)
- ✅ Runs within Claude Code context
- ✅ Has access to Claude Code tools
- ✅ Can invoke other Claude Code skills
- ✅ Fully ToS compliant
- ✅ Transparent (you see all activity in your terminal)

## Phase 1: MVP Features

### 1. Memory Persistence System

**Objective:** Enable the agent to accumulate and recall knowledge across sessions.

#### Requirements

**Functional:**
- FR1.1: Store memories in human-readable markdown files
- FR1.2: Daily memory logs at `memory/YYYY-MM-DD.md`
- FR1.3: Curated long-term memory in `MEMORY.md`
- FR1.4: Hybrid search combining vector embeddings + keyword matching
- FR1.5: SQLite database with sqlite-vec extension for vector storage
- FR1.6: Full-text search (FTS5) for keyword queries
- FR1.7: Session transcript storage in JSONL format
- FR1.8: Auto-indexing on file changes (file watcher)
- FR1.9: Memory search tool accessible to agent during conversations

**Non-Functional:**
- NFR1.1: Search results returned in <500ms for 95th percentile
- NFR1.2: Support up to 100,000 memory entries without degradation
- NFR1.3: Memory files remain human-readable and editable
- NFR1.4: Graceful degradation if vector search unavailable

#### Technical Specifications

**Storage:**
```
~/.mudpuppy/
├── memory/
│   ├── 2026-02-02.md          # Daily logs
│   ├── 2026-02-03.md
│   └── ...
├── MEMORY.md                   # Curated long-term
├── agents/
│   └── default/
│       ├── sessions/
│       │   ├── main.jsonl      # Session transcripts
│       │   └── ...
│       └── memory.db           # SQLite + embeddings
```

**Database Schema:**
```sql
CREATE TABLE memories (
  id INTEGER PRIMARY KEY,
  content TEXT NOT NULL,
  source TEXT,              -- file path or session ID
  timestamp INTEGER,
  embedding BLOB,           -- vector embedding
  metadata JSON
);

CREATE VIRTUAL TABLE memories_fts USING fts5(
  content,
  source,
  content='memories'
);
```

**Search API:**
```typescript
interface MemorySearchOptions {
  query: string;
  mode: 'hybrid' | 'vector' | 'keyword';
  limit?: number;
  threshold?: number;
}

interface MemoryResult {
  content: string;
  source: string;
  score: number;
  timestamp: number;
}

async function searchMemory(options: MemorySearchOptions): Promise<MemoryResult[]>
```

### 2. Soul & Identity System

**Objective:** Implement persistent, evolving agent personality through file-based configuration.

#### Requirements

**Functional:**
- FR2.1: Bootstrap files define agent personality and behavior
- FR2.2: `SOUL.md` contains core personality traits (agent can modify)
- FR2.3: `IDENTITY.md` contains concrete identifiers (name, type, avatar)
- FR2.4: `AGENTS.md` contains operating instructions and safety rules
- FR2.5: `USER.md` contains user profile information
- FR2.6: `BOOTSTRAP.md` for first-run initialization (auto-deleted)
- FR2.7: Files injected into Claude Code context at session start
- FR2.8: Agent can propose changes to SOUL.md, AGENTS.md (requires approval)
- FR2.9: Changes tracked with git-style diffs before approval

**Non-Functional:**
- NFR2.1: Bootstrap files loaded in <100ms
- NFR2.2: File changes reflected in next session automatically
- NFR2.3: Manual file edits supported and respected

#### File Templates

**SOUL.md Structure:**
```markdown
# Soul

## Core Essence
[Who you are at the deepest level]

## Communication Style
[How you express yourself]

## Boundaries
[What you will and won't do]

## Evolution
[How you've changed over time]
```

**IDENTITY.md Structure:**
```markdown
# Identity

- **Name**: [Agent name]
- **Type**: [AI assistant, companion, etc.]
- **Vibe**: [Core feeling/aesthetic]
- **Emoji**: [Signature emoji]
- **Avatar**: [Description or path]
```

**AGENTS.md Structure:**
```markdown
# Operating Instructions

## Memory Protocol
[How to use memory system]

## Safety Rules
[Security boundaries]

## Autonomous Behavior
[Guidelines for self-initiated actions]

## External vs Internal Actions
[When to interact with outside systems]
```

### 3. Basic Autonomy (Heartbeat)

**Objective:** Enable periodic self-initiated agent activity with security controls.

#### Requirements

**Functional:**
- FR3.1: Configurable heartbeat interval (default: 30 minutes)
- FR3.2: `HEARTBEAT.md` file contains task checklist
- FR3.3: Agent reads HEARTBEAT.md and executes pending tasks
- FR3.4: Support for `HEARTBEAT_OK` token to suppress empty responses
- FR3.5: Active hours configuration (timezone-aware)
- FR3.6: Pause/resume heartbeat via CLI command
- FR3.7: All heartbeat actions logged to audit trail
- FR3.8: Approval requirement for high-risk heartbeat actions
- FR3.9: Heartbeat only runs when main session idle

**Non-Functional:**
- NFR3.1: Heartbeat trigger accurate within ±1 minute
- NFR3.2: Failed heartbeat doesn't crash system
- NFR3.3: Configurable retry logic with exponential backoff

#### Configuration

```typescript
interface HeartbeatConfig {
  enabled: boolean;
  interval: number;              // milliseconds
  activeHours?: {
    start: string;               // "09:00"
    end: string;                 // "23:00"
    timezone: string;            // "America/Los_Angeles"
  };
  requireApproval: boolean;      // approval-first mode
  maxActionsPerBeat: number;     // safety limit
}
```

**HEARTBEAT.md Format:**
```markdown
# Heartbeat Tasks

## Recurring
- [ ] Check for important notifications
- [ ] Update daily memory log if significant events

## One-time
- [ ] Research topic X (added 2026-02-02)
- [x] Completed task (done 2026-02-01)

---
HEARTBEAT_OK
```

### 4. Telegram Integration

**Objective:** Enable **bidirectional** remote interaction and control via Telegram - both sending messages to Claude AND receiving responses/notifications.

**Key Feature:** Telegram becomes a remote interface to your Claude Code session, allowing full control while away from your computer.

#### Requirements

**Functional:**
- FR4.1: Telegram bot based on grammY library
- FR4.2: DM pairing system (user must initiate with `/start`)
- FR4.3: **Bidirectional messaging:** Telegram ↔ Claude Code ↔ Telegram
- FR4.4: Route incoming Telegram messages to Claude Code session
- FR4.5: Route Claude Code responses back to Telegram user
- FR4.6: **Remote approvals:** Approval requests sent to Telegram, can approve remotely
- FR4.7: **Remote commands:** `/status`, `/pause`, `/resume` work from Telegram
- FR4.8: HTML formatting for rich message display
- FR4.9: Draft streaming support (real-time response updates)
- FR4.10: Heartbeat notifications sent to Telegram
- FR4.11: Configuration via environment variables (bot token)
- FR4.12: **Context awareness:** Claude knows when messages are from Telegram vs CLI

**Non-Functional:**
- NFR4.1: Message delivery within 2 seconds
- NFR4.2: Support long-polling (webhook optional)
- NFR4.3: Handle Telegram API rate limits gracefully
- NFR4.4: Secure token storage (not in git)

#### Security Requirements

**SR4.1:** Bot token stored in `~/.mudpuppy/secrets.env` (gitignored)
**SR4.2:** Only paired users can interact with bot
**SR4.3:** Pairing requires approval on local machine
**SR4.4:** All Telegram commands logged to audit trail
**SR4.5:** No sensitive information sent over Telegram without user approval

#### Bidirectional Flow Examples

**Scenario 1: Remote Chat**
```
[You on Telegram]: "What's on my calendar today?"
  ↓
[Routes to Claude Code session]
  ↓
[Claude processes using your subscription]
  ↓
[You on Telegram receive]: "You have 3 meetings: ..."
```

**Scenario 2: Remote Approval**
```
[Heartbeat triggers on your computer]
  ↓
[Needs approval to update memory]
  ↓
[You on Telegram receive]: "⚠️ APPROVAL: Update MEMORY.md? [APPROVE/DENY]"
  ↓
[You on Telegram]: "APPROVE"
  ↓
[Approval routes to Claude Code]
  ↓
[Action executes]
  ↓
[You on Telegram receive]: "✅ Memory updated"
```

**Scenario 3: Remote Command**
```
[You on Telegram]: "/status"
  ↓
[Routes to Mudpuppy skill]
  ↓
[Skill queries system status]
  ↓
[You on Telegram receive]: "📊 Status: Online, 3 tasks pending, uptime 4h"
```

#### API Design

```typescript
interface TelegramConfig {
  botToken: string;
  pairedUsers: number[];         // Telegram user IDs
  enableGroups: boolean;
  notifyHeartbeat: boolean;
}

class TelegramBridge {
  // Outgoing (to Telegram)
  async sendMessage(userId: number, text: string, options?: MessageOptions): Promise<void>
  async sendNotification(text: string): Promise<void>
  async requestApproval(userId: number, request: ApprovalRequest): Promise<boolean>

  // Incoming (from Telegram)
  async routeToClaudeCode(userId: number, message: string): Promise<void>
  async handleCommand(userId: number, command: string): Promise<void>

  // Pairing
  async pairUser(userId: number): Promise<boolean>  // requires local approval
  async unpairUser(userId: number): Promise<void>
}

// Integration with Claude Code
interface ClaudeCodeIntegration {
  async sendMessage(text: string, context: MessageContext): Promise<string>
  async onResponse(callback: (response: string, destination: string) => void): void
  async requestApproval(request: ApprovalRequest): Promise<boolean>
}
```

## Cross-Cutting Requirements

### Security & Privacy

**Approval System:**
- All file writes require approval (except memory logs)
- All external network requests require approval
- All command executions require approval
- Approval UI shows exact action with preview
- Approval decisions cached per session (optional)

**Audit Logging:**
- All tool executions logged with timestamp
- All file changes logged with diffs
- All autonomous actions logged with trigger
- Logs stored at `~/.mudpuppy/audit.log`
- Log rotation after 10MB or 30 days

**Sandboxing:**
- Memory database isolated from main filesystem
- Telegram bot runs in separate process
- File access restricted to `~/.mudpuppy/` by default
- Environment variables for secrets (never in code)

### Performance

- Memory search: <500ms p95
- Bootstrap file loading: <100ms
- Heartbeat trigger accuracy: ±1 minute
- Telegram message delivery: <2 seconds

### Reliability

- Graceful degradation if components fail
- Retry logic with exponential backoff
- State recovery after crash
- Health check endpoint
- Process monitoring

### Observability

- Structured logging (JSON format)
- Log levels: debug, info, warn, error
- Metrics collection (optional, local only)
- Status dashboard (CLI command: `openclaw status`)

## User Interface

### CLI Commands

```bash
# Initialize new agent
openclaw init

# Start the agent (with heartbeat)
openclaw start

# Stop the agent
openclaw stop

# Status check
openclaw status

# Memory search
openclaw memory search "query"

# Memory add
openclaw memory add "content" [--source=file]

# Telegram pairing
openclaw telegram pair

# Configuration
openclaw config set heartbeat.interval 1800000
openclaw config get

# Audit log
openclaw audit [--tail] [--filter=tool:exec]
```

### Approval UI

Text-based approval prompts in terminal:

```
┌──────────────────────────────────────────────────┐
│ APPROVAL REQUIRED                                │
├──────────────────────────────────────────────────┤
│ Tool: file_write                                 │
│ File: ~/.mudpuppy/SOUL.md                 │
│                                                  │
│ Diff:                                            │
│ - ## Boundaries                                  │
│ + ## Boundaries & Values                         │
│                                                  │
│ Reason: Updating soul to reflect new learning    │
│                                                  │
│ [A]pprove  [D]eny  [V]iew full  [R]emember      │
└──────────────────────────────────────────────────┘
```

## Technical Architecture

### Plugin Structure

```
mudpuppy/
├── src/
│   ├── plugin.ts              # Main plugin entry point
│   ├── memory/
│   │   ├── index.ts           # Memory system
│   │   ├── search.ts          # Hybrid search
│   │   ├── embeddings.ts      # Vector embeddings
│   │   └── storage.ts         # SQLite + FTS
│   ├── soul/
│   │   ├── index.ts           # Soul/Identity system
│   │   ├── bootstrap.ts       # File loader
│   │   └── templates.ts       # Default templates
│   ├── autonomy/
│   │   ├── heartbeat.ts       # Heartbeat engine
│   │   ├── scheduler.ts       # Future: cron
│   │   └── executor.ts        # Action execution
│   ├── telegram/
│   │   ├── bot.ts             # Telegram bot
│   │   ├── pairing.ts         # User pairing
│   │   └── formatter.ts       # Message formatting
│   ├── tools/
│   │   ├── memory.ts          # Memory tools
│   │   ├── soul.ts            # Soul update tools
│   │   └── telegram.ts        # Telegram tools
│   ├── security/
│   │   ├── approval.ts        # Approval manager
│   │   ├── audit.ts           # Audit logging
│   │   └── sandbox.ts         # Future: sandboxing
│   └── cli/
│       └── index.ts           # CLI commands
├── templates/                 # Bootstrap file templates
├── tests/
├── package.json
├── tsconfig.json
└── README.md
```

### Plugin Integration with Claude Code

The plugin hooks into Claude Code at these extension points:

1. **Context Injection**: Bootstrap files loaded at session start
2. **Tool Registration**: Memory, soul, telegram tools added to tool registry
3. **Background Tasks**: Heartbeat scheduled via Claude Code task system
4. **Event Hooks**: File watch, session start/end, message received

### Data Flow: Memory Search

```
User Query
    ↓
Claude Code receives message
    ↓
Plugin injects memory search tool
    ↓
Agent decides to search memory
    ↓
memory_search(query: "previous discussion about X")
    ↓
┌─────────────────────────────┐
│ Hybrid Search Engine        │
│ ┌─────────┐   ┌──────────┐ │
│ │ Vector  │   │ Keyword  │ │
│ │ Search  │   │ Search   │ │
│ │ (HNSW)  │   │ (FTS5)   │ │
│ └────┬────┘   └────┬─────┘ │
│      │             │        │
│      └──────┬──────┘        │
│           ┌─▼─┐             │
│           │ ⊕ │ Combine     │
│           └─┬─┘             │
└─────────────┼───────────────┘
              ↓
    Results ranked by relevance
              ↓
    Injected into context
              ↓
    Agent uses results to answer
```

### Data Flow: Autonomous Heartbeat

```
Timer triggers (every 30 min)
    ↓
Check active hours (if configured)
    ↓
Check if main session idle
    ↓
Load HEARTBEAT.md
    ↓
Parse uncompleted tasks
    ↓
Create agent turn in main session
    ↓
Agent processes tasks
    ↓
┌─────────────────────────────┐
│ For each action:            │
│   ┌──────────────────┐      │
│   │ Requires         │      │
│   │ approval?        │      │
│   └────┬─────────────┘      │
│   Yes  │  No                │
│   ┌────▼────┐  ┌─────────┐ │
│   │ Show    │  │ Execute │ │
│   │ prompt  │  │ directly│ │
│   └────┬────┘  └────┬────┘ │
│        │            │       │
│  ┌─────▼────────────▼────┐ │
│  │ Log to audit trail     │ │
│  └────────────────────────┘ │
└─────────────────────────────┘
    ↓
Update HEARTBEAT.md (mark completed)
    ↓
Send notification to Telegram (if configured)
```

## Development Plan

**IMPORTANT EXECUTION NOTES:**
1. **Test-driven development**: Each phase must be fully tested with human-in-the-loop validation before moving to next phase
2. **Progress tracking**: Maintain PROGRESS.md file across all sessions to track completion status
3. **Iterative refinement**: Expect loose requirements to be refined during implementation
4. **No feature creep**: Do not proceed to next phase until current phase is proven working

### Phase 0: Project Setup & Foundation

**Objective:** Bootstrap TypeScript project with basic tooling and structure.

**Tasks:**
- Initialize TypeScript project with proper tsconfig
- Set up build tooling (esbuild or tsc)
- Configure testing framework (vitest)
- Create basic project structure (src/, tests/, templates/)
- Implement configuration system (JSON-based)
- Set up git repository with proper .gitignore

**Acceptance Criteria:**
- [ ] `npm run build` compiles TypeScript without errors
- [ ] `npm run test` runs test suite successfully
- [ ] Basic CLI entry point exists and runs (`openclaw --version`)
- [ ] Configuration can be loaded from `~/.mudpuppy/config.json`
- [ ] All secrets/tokens properly gitignored

**Testing:**
- Manual: Run build, run tests, execute CLI
- Unit tests: Configuration loading
- Human validation: Review project structure

**Estimated Time:** 1-2 sessions
**Blocker for:** All other phases

---

### Phase 1: Telegram Integration (PRIORITY)

**Objective:** Get basic Telegram bot working for remote testing and interaction.

**Rationale:** Enables remote testing while away from house, unlocks async development workflow.

**Tasks:**
- Install and configure grammY library
- Create basic bot that responds to messages
- Implement `/start` command for pairing
- Store bot token in `~/.mudpuppy/secrets.env`
- Local approval UI for pairing requests
- Message routing: Telegram → local agent context
- Response routing: agent output → Telegram
- Basic HTML formatting for messages
- `/status` command to check bot health

**Acceptance Criteria:**
- [ ] Bot comes online when `openclaw start` runs
- [ ] User can send `/start` to bot
- [ ] Pairing request appears in local terminal
- [ ] After approval, user is paired
- [ ] Messages sent to bot appear in local agent context
- [ ] Agent responses sent back to Telegram
- [ ] `/status` command returns bot uptime and paired users
- [ ] Bot gracefully handles rate limits
- [ ] Bot token is NOT in git repository

**Testing:**
- Manual: Send messages via Telegram, verify responses
- Integration: Full pairing flow from Telegram to local approval
- Edge cases: Invalid commands, rate limiting, bot restart
- Human validation: Use bot for 24 hours, verify stability

**Estimated Time:** 2-3 sessions
**Blocker for:** Heartbeat notifications, remote testing

---

### Phase 2: Soul & Identity System

**Objective:** Implement persistent agent personality through bootstrap files.

**Tasks:**
- Create bootstrap file templates (SOUL.md, IDENTITY.md, AGENTS.md, USER.md)
- Implement first-run initialization flow (BOOTSTRAP.md)
- File loader that reads bootstrap files
- Context injection mechanism for Claude Code
- Soul update tool (agent can propose changes)
- Approval flow for soul/agents modifications
- Git-style diff display before approval
- Automatic reload on file changes

**Acceptance Criteria:**
- [ ] On first run, BOOTSTRAP.md guides user through setup
- [ ] All bootstrap files created in `~/.mudpuppy/`
- [ ] Files injected into agent context at session start
- [ ] Agent maintains consistent personality across sessions
- [ ] Agent can propose changes to SOUL.md (with approval)
- [ ] Manual file edits reflected in next session
- [ ] Diff shown before approving soul updates

**Testing:**
- Manual: First-run experience, personality consistency
- Unit tests: File loading, template rendering
- Integration: Edit SOUL.md manually, verify reload
- Human validation: Chat with agent over 3+ sessions, verify personality persists

**Estimated Time:** 2-3 sessions
**Blocker for:** Personality evolution, user profiling

---

### Phase 3: Memory Persistence System

**Objective:** Enable agent to accumulate and search knowledge across sessions.

**Tasks:**
- Set up SQLite database with schema
- Install and configure sqlite-vec extension
- Implement FTS5 virtual table for keyword search
- Embedding generation (choose provider: OpenAI or local)
- Hybrid search combining vector + keyword
- Memory indexing on startup
- File watcher for auto-indexing new memory files
- Daily memory log creation (`memory/YYYY-MM-DD.md`)
- Session transcript logging (JSONL format)
- `memory_search` tool for agent
- CLI: `openclaw memory search "query"`
- CLI: `openclaw memory add "content"`

**Acceptance Criteria:**
- [ ] Memory database created at `~/.mudpuppy/agents/default/memory.db`
- [ ] Daily log auto-created when agent runs
- [ ] Session transcripts saved to JSONL
- [ ] `memory_search` tool returns relevant results
- [ ] Hybrid search works (both vector and keyword)
- [ ] Search results in <500ms for 1000+ entries
- [ ] File changes auto-indexed within 5 seconds
- [ ] Manual memory edits searchable immediately

**Testing:**
- Unit tests: Search algorithm, embedding generation, database queries
- Integration: Add memories, search, verify results
- Performance: Load 10,000 entries, verify search speed
- Human validation: Use agent for 1 week, verify memory recall accuracy

**Estimated Time:** 3-4 sessions
**Blocker for:** Learning capabilities, knowledge accumulation

---

### Phase 4: Basic Autonomy (Heartbeat)

**Objective:** Enable periodic self-initiated agent activity with security controls.

**Tasks:**
- Heartbeat scheduler with configurable interval
- HEARTBEAT.md parser (checkbox format)
- Task execution engine
- Approval manager for high-risk actions
- Audit logging system (`audit.log`)
- Active hours configuration (timezone-aware)
- CLI: `openclaw heartbeat pause/resume`
- CLI: `openclaw audit --tail`
- Telegram notification integration (from Phase 1)
- `HEARTBEAT_OK` token support

**Acceptance Criteria:**
- [ ] Heartbeat triggers every N minutes (configurable)
- [ ] Reads unchecked tasks from HEARTBEAT.md
- [ ] Executes tasks with approval for risky actions
- [ ] All actions logged to audit trail
- [ ] Respects active hours configuration
- [ ] Sends notifications to Telegram on completion
- [ ] Can pause/resume via CLI and Telegram
- [ ] No heartbeat when main session active
- [ ] Failed heartbeat doesn't crash system

**Testing:**
- Unit tests: Parser, scheduler, task executor
- Integration: Full heartbeat cycle with approvals
- Edge cases: System restart, clock changes, concurrent sessions
- Security: Verify all risky actions require approval
- Human validation: Run for 48 hours, verify reliability

**Estimated Time:** 3-4 sessions
**Blocker for:** Full autonomy, cron scheduling

---

### Phase 5: Security Hardening & Polish

**Objective:** Finalize security features and prepare for daily use.

**Tasks:**
- Approval UI polish (better formatting, colors)
- Secrets management audit (no tokens in git)
- Audit log viewer with filtering
- Security testing (penetration test)
- Documentation (README, setup guide)
- Error handling improvements
- Graceful shutdown handling
- Health check system
- Backup/restore functionality

**Acceptance Criteria:**
- [ ] All secrets properly isolated
- [ ] Approval UI is clear and user-friendly
- [ ] Audit log complete and searchable
- [ ] No security vulnerabilities in testing
- [ ] Documentation complete
- [ ] Error messages helpful
- [ ] System recovers from crashes
- [ ] Backups created automatically

**Testing:**
- Security audit: Review all approval points
- Penetration test: Attempt to bypass approvals
- Stress test: High message volume, rapid approvals
- Human validation: Use as primary agent for 1 week

**Estimated Time:** 2-3 sessions
**Blocker for:** Production use

---

### Future Phases (Post-MVP)

**Not in current scope, but roadmap:**
- Full cron scheduling (beyond heartbeat)
- Sandbox isolation (Docker containers)
- Tool orchestration layers
- Subagent spawning
- Web dashboard (optional UI)
- Additional messaging platforms (WhatsApp, Signal, etc.)
- Plugin SDK for community extensions
- Multi-agent support (separate identities)

## Success Metrics

### MVP Success Criteria

1. **Memory works**: Agent can recall information from previous sessions with >90% accuracy
2. **Identity persists**: Agent maintains consistent personality across sessions
3. **Heartbeat reliable**: Executes scheduled tasks within ±1 minute, 99% uptime
4. **Telegram functional**: Messages delivered within 2 seconds, pairing works flawlessly
5. **Security effective**: Zero unapproved actions in testing, audit log complete
6. **User satisfaction**: Primary user (you) uses it daily for 1+ week

### Key Performance Indicators

- **Memory search latency**: <500ms p95
- **Heartbeat accuracy**: ±1 minute
- **Telegram delivery time**: <2 seconds
- **Approval response time**: User decision within 30 seconds
- **System uptime**: >99% when running
- **Crash recovery**: Automatic restart within 1 minute

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Memory search too slow | High | Medium | Optimize indexing, use incremental updates, cache frequently accessed |
| Approval fatigue | High | High | Smart approval caching, risk-based auto-approval for low-risk actions |
| Heartbeat runaway | Critical | Low | Max actions per beat, kill switch, active hours enforcement |
| Telegram token leak | Critical | Medium | Secrets in gitignored file, env vars only, audit access |
| Plugin conflicts with Claude Code updates | Medium | Medium | Minimal core modifications, version pinning, compatibility testing |
| Memory corruption | High | Low | Database backups, WAL mode, fsync on write, integrity checks |

## Open Questions

1. **Embedding provider**: OpenAI, local model (sentence-transformers), or both?
2. **Backup strategy**: Automatic backups of memory database and bootstrap files?
3. **Multi-agent**: Support multiple agent identities in future phases?
4. **Sharing**: Export/import memory snapshots between users?
5. **Mobile**: iOS/Android app for Telegram alternative?

## Appendix

### Glossary

- **Bootstrap files**: Configuration files that define agent personality and behavior
- **Soul**: Core personality essence that evolves over time
- **Identity**: Concrete metadata about the agent (name, avatar, etc.)
- **Heartbeat**: Periodic autonomous check-in by the agent
- **Memory**: Persistent knowledge storage with hybrid search
- **Approval-first**: Security model requiring user approval for actions
- **Hybrid search**: Combination of vector similarity and keyword matching

### References

- OpenClaw source code: `/home/localadmin/Desktop/workspace/openclaw`
- OpenClaw workspace: `/home/localadmin/clawd`
- Claude Code documentation: https://github.com/anthropics/claude-code
- grammY documentation: https://grammy.dev/
- sqlite-vec: https://github.com/asg017/sqlite-vec

### Version History

- **v1.0** (2026-02-02): Initial PRD based on user requirements
