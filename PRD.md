# Product Requirements Document: Mudpuppy v2

**Version:** 2.0
**Date:** 2026-02-02
**Status:** Draft
**Architecture:** MCP-first (revised from v1 skill-first approach)

---

## Executive Summary

Mudpuppy is a **security-hardened autonomous AI agent** that extends Claude Code with persistent memory, evolving personality, and controlled autonomous execution. It provides bidirectional remote control via Telegram while using your existing Claude subscription.

**Key Architectural Decision (v2):** Mudpuppy is built as an **MCP server first**, exposing all capabilities as tools. The Claude Code skill becomes a thin persona/workflow layer on top, not the foundation. This provides clean separation of concerns and better portability.

---

## Vision Statement

Create a fully autonomous AI agent that learns and evolves through use:
- **Persistent memory** that accumulates knowledge over time
- **Consistent identity** through the Soul/Identity separation framework
- **Controlled autonomy** via heartbeat and cron scheduling
- **Multi-surface presence** starting with Telegram integration
- **Human-readable state** through file-based architecture

---

## Architecture Overview

### v1 vs v2 Comparison

```
v1 (Skill-First) - DEPRECATED:
┌─────────────┐    JSONL     ┌─────────────┐
│ Telegram Bot│ ←──────────→ │ Claude Code │
│ (standalone)│   files      │   (skill)   │
└─────────────┘              └─────────────┘
Problem: Skill reads files, bot writes files, messy coupling

v2 (MCP-First) - NEW:
┌─────────────────────────────────────────────────────┐
│                    MCP Server                        │
│            (core - all capabilities)                 │
├──────────┬──────────┬───────────┬──────────────────┤
│ telegram │  memory  │   soul    │    heartbeat     │
│  tools   │  tools   │   tools   │     tools        │
└────┬─────┴────┬─────┴─────┬─────┴────────┬─────────┘
     │          │           │              │
     ▼          ▼           ▼              ▼
 Telegram    SQLite      Files         Scheduler
   Bot         DB      (*.md)

┌─────────────────────────────────────────────────────┐
│              Claude Code + Skill                     │
│         (consumes MCP tools, adds persona)          │
└─────────────────────────────────────────────────────┘
```

### Design Principles

1. **MCP-first**: All capabilities exposed as MCP tools with structured I/O
2. **Capabilities before persona**: Build tools first, add personality layer last
3. **No file-queue coupling**: Direct communication between components
4. **Portable by default**: No hardcoded paths, all config via environment
5. **Text > Brain**: All state persists in human-readable files
6. **Approval-first security**: Risky actions require explicit approval

---

## Core Components

### 1. MCP Server (Foundation)

The MCP server is the core of Mudpuppy. It exposes all capabilities as tools that Claude Code can invoke.

**Location:** `~/.mudpuppy/mcp-server/` (or embedded in main package)

**Tool Categories:**

| Category | Tools | Purpose |
|----------|-------|---------|
| `telegram_*` | poll, send, pair, status | Telegram messaging |
| `memory_*` | search, add, get, update, delete, stats | Knowledge persistence |
| `soul_*` | read, propose_update, get_identity | Personality management |
| `heartbeat_*` | status, pause, resume, run_now | Autonomous execution |
| `config_*` | get, set | Configuration management |

**MCP Server Configuration:**
```json
{
  "mcpServers": {
    "mudpuppy": {
      "command": "node",
      "args": ["~/.mudpuppy/dist/mcp-server.js"],
      "env": {
        "MUDPUPPY_HOME": "~/.mudpuppy"
      }
    }
  }
}
```

### 2. Telegram Integration

Telegram is a **transport**, not the core. The MCP server provides tools; the Telegram bot is a separate process that the tools communicate with.

**Architecture:**
```
┌─────────────┐  Unix Socket  ┌─────────────┐
│ MCP Server  │ ←───────────→ │ Telegram Bot│ ←──→ Telegram API
│ (tools)     │  (IPC)        │ (daemon)    │
└─────────────┘               └─────────────┘
```

**Bot runs as daemon**, MCP tools communicate with it via Unix socket at `~/.mudpuppy/bot/bot.sock`.

### 3. Memory System

SQLite database with hybrid search (vector + keyword). Incorporates atlas-agent patterns.

**Key Features:**
- Typed entries (fact, preference, event, insight, task, relationship)
- Content hash deduplication
- Access logging for analytics
- Configurable hybrid search weights

### 4. Soul/Identity System

File-based personality persistence. Simple file reads/writes, no complex logic.

**Files:**
- `SOUL.md` - Core personality (agent can propose changes)
- `IDENTITY.md` - Metadata (name, emoji, avatar)
- `AGENTS.md` - Operating instructions
- `USER.md` - User profile

### 5. Autonomy Engine

Heartbeat scheduler for periodic self-initiated actions.

**Features:**
- Configurable intervals
- Active hours (timezone-aware)
- Task execution from HEARTBEAT.md
- Approval flow for risky actions

### 6. Skill Layer (Optional)

Thin persona wrapper that consumes MCP tools. Added last, not first.

**Purpose:**
- Inject personality context
- Define workflows ("when message arrives, do X")
- NOT for core capabilities

---

## Workspace Structure

```
~/.mudpuppy/
├── config.json              # Global configuration
├── secrets.env              # Secrets (gitignored, recreate on new VM)
│
├── mcp-server/              # MCP server (if separate package)
│   └── ...
│
├── bot/                     # Telegram bot daemon
│   ├── bot.pid              # Process ID file
│   └── bot.sock             # Unix socket for IPC
│
├── workspace/               # Agent workspace (human-editable)
│   ├── SOUL.md              # Core personality
│   ├── IDENTITY.md          # Agent identifiers
│   ├── AGENTS.md            # Operating instructions
│   ├── USER.md              # User profile
│   ├── MEMORY.md            # Curated long-term memory
│   ├── HEARTBEAT.md         # Autonomous task list
│   └── memory/              # Daily logs
│       └── YYYY-MM-DD.md
│
├── data/                    # Application data
│   ├── memory.db            # SQLite + embeddings
│   ├── sessions/            # Session transcripts (JSONL)
│   └── audit.log            # Audit trail
│
└── tools/                   # Tool documentation
    └── manifest.md          # Tool index
```

**Portability Notes:**
- All paths relative to `$MUDPUPPY_HOME` (defaults to `~/.mudpuppy`)
- No hardcoded absolute paths in code
- `secrets.env` must be recreated on new machine
- SQLite database is file-based, just copy it

---

## MCP Tool Specifications

### Telegram Tools

```typescript
// telegram_poll - Get pending messages
{
  name: "telegram_poll",
  description: "Get pending Telegram messages from paired users",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number", default: 10 },
      markRead: { type: "boolean", default: true }
    }
  },
  outputSchema: {
    type: "object",
    properties: {
      messages: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            userId: { type: "number" },
            username: { type: "string" },
            text: { type: "string" },
            timestamp: { type: "number" }
          }
        }
      }
    }
  }
}

// telegram_send - Send message to user
{
  name: "telegram_send",
  description: "Send a message to a paired Telegram user",
  inputSchema: {
    type: "object",
    properties: {
      userId: { type: "number", required: true },
      text: { type: "string", required: true },
      parseMode: { type: "string", enum: ["HTML", "Markdown"], default: "HTML" },
      replyToMessageId: { type: "number" }
    }
  },
  outputSchema: {
    type: "object",
    properties: {
      success: { type: "boolean" },
      messageId: { type: "number" }
    }
  }
}

// telegram_pair - Handle pairing request
{
  name: "telegram_pair",
  description: "Approve or deny a Telegram pairing request",
  inputSchema: {
    type: "object",
    properties: {
      userId: { type: "number", required: true },
      approve: { type: "boolean", required: true }
    }
  },
  outputSchema: {
    type: "object",
    properties: {
      success: { type: "boolean" },
      pairedUsers: { type: "number" }
    }
  }
}

// telegram_status - Get bot status
{
  name: "telegram_status",
  description: "Get Telegram bot status and statistics",
  inputSchema: { type: "object", properties: {} },
  outputSchema: {
    type: "object",
    properties: {
      online: { type: "boolean" },
      uptime: { type: "number" },
      pairedUsers: { type: "number" },
      pendingMessages: { type: "number" },
      pendingPairings: { type: "number" }
    }
  }
}
```

### Memory Tools

```typescript
// memory_search - Search memories with hybrid search
{
  name: "memory_search",
  description: "Search memories using hybrid vector + keyword search",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", required: true },
      mode: { type: "string", enum: ["hybrid", "vector", "keyword"], default: "hybrid" },
      limit: { type: "number", default: 10 },
      entryTypes: {
        type: "array",
        items: { type: "string", enum: ["fact", "preference", "event", "insight", "task", "relationship"] }
      },
      minImportance: { type: "number", minimum: 1, maximum: 10 },
      minConfidence: { type: "number", minimum: 0, maximum: 1 },
      tags: { type: "array", items: { type: "string" } }
    }
  },
  outputSchema: {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "number" },
            content: { type: "string" },
            entryType: { type: "string" },
            score: { type: "number" },
            confidence: { type: "number" },
            importance: { type: "number" },
            source: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            createdAt: { type: "number" }
          }
        }
      },
      totalMatches: { type: "number" }
    }
  }
}

// memory_add - Add a new memory
{
  name: "memory_add",
  description: "Add a new memory entry",
  inputSchema: {
    type: "object",
    properties: {
      content: { type: "string", required: true },
      entryType: {
        type: "string",
        enum: ["fact", "preference", "event", "insight", "task", "relationship"],
        default: "fact"
      },
      source: { type: "string", default: "manual" },
      context: { type: "string" },
      confidence: { type: "number", default: 1.0, minimum: 0, maximum: 1 },
      importance: { type: "number", default: 5, minimum: 1, maximum: 10 },
      tags: { type: "array", items: { type: "string" } },
      expiresAt: { type: "number" }
    }
  },
  outputSchema: {
    type: "object",
    properties: {
      success: { type: "boolean" },
      id: { type: "number" },
      duplicate: { type: "boolean" },
      existingId: { type: "number" }
    }
  }
}

// memory_get - Get a specific memory by ID
{
  name: "memory_get",
  description: "Retrieve a specific memory entry by ID",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "number", required: true }
    }
  },
  outputSchema: {
    type: "object",
    properties: {
      entry: {
        type: "object",
        properties: {
          id: { type: "number" },
          content: { type: "string" },
          entryType: { type: "string" },
          source: { type: "string" },
          context: { type: "string" },
          confidence: { type: "number" },
          importance: { type: "number" },
          tags: { type: "array" },
          createdAt: { type: "number" },
          updatedAt: { type: "number" },
          expiresAt: { type: "number" },
          accessCount: { type: "number" }
        }
      }
    }
  }
}

// memory_stats - Get memory statistics
{
  name: "memory_stats",
  description: "Get statistics about the memory database",
  inputSchema: { type: "object", properties: {} },
  outputSchema: {
    type: "object",
    properties: {
      totalEntries: { type: "number" },
      byType: { type: "object" },
      avgImportance: { type: "number" },
      avgConfidence: { type: "number" },
      oldestEntry: { type: "number" },
      newestEntry: { type: "number" },
      totalAccesses: { type: "number" }
    }
  }
}
```

### Soul Tools

```typescript
// soul_read - Read soul/identity files
{
  name: "soul_read",
  description: "Read soul, identity, or agents file",
  inputSchema: {
    type: "object",
    properties: {
      file: {
        type: "string",
        enum: ["soul", "identity", "agents", "user"],
        required: true
      }
    }
  },
  outputSchema: {
    type: "object",
    properties: {
      content: { type: "string" },
      lastModified: { type: "number" }
    }
  }
}

// soul_propose_update - Propose a soul update (requires approval)
{
  name: "soul_propose_update",
  description: "Propose an update to SOUL.md (requires user approval)",
  inputSchema: {
    type: "object",
    properties: {
      file: { type: "string", enum: ["soul", "agents"], required: true },
      newContent: { type: "string", required: true },
      reason: { type: "string", required: true }
    }
  },
  outputSchema: {
    type: "object",
    properties: {
      proposalId: { type: "string" },
      diff: { type: "string" },
      status: { type: "string", enum: ["pending", "approved", "denied"] }
    }
  }
}
```

### Heartbeat Tools

```typescript
// heartbeat_status - Get heartbeat status
{
  name: "heartbeat_status",
  description: "Get current heartbeat/autonomy status",
  inputSchema: { type: "object", properties: {} },
  outputSchema: {
    type: "object",
    properties: {
      enabled: { type: "boolean" },
      paused: { type: "boolean" },
      interval: { type: "number" },
      lastRun: { type: "number" },
      nextRun: { type: "number" },
      pendingTasks: { type: "number" },
      inActiveHours: { type: "boolean" }
    }
  }
}

// heartbeat_pause - Pause heartbeat
{
  name: "heartbeat_pause",
  description: "Pause autonomous heartbeat execution",
  inputSchema: { type: "object", properties: {} },
  outputSchema: {
    type: "object",
    properties: {
      success: { type: "boolean" },
      wasPaused: { type: "boolean" }
    }
  }
}

// heartbeat_resume - Resume heartbeat
{
  name: "heartbeat_resume",
  description: "Resume autonomous heartbeat execution",
  inputSchema: { type: "object", properties: {} },
  outputSchema: {
    type: "object",
    properties: {
      success: { type: "boolean" },
      nextRun: { type: "number" }
    }
  }
}
```

---

## Database Schema

```sql
-- Memory entries with typed data and metadata
CREATE TABLE memory_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  content_hash TEXT UNIQUE NOT NULL,        -- SHA-256 for deduplication
  entry_type TEXT NOT NULL DEFAULT 'fact',  -- fact|preference|event|insight|task|relationship
  source TEXT DEFAULT 'manual',
  context TEXT,
  confidence REAL DEFAULT 1.0 CHECK(confidence >= 0 AND confidence <= 1),
  importance INTEGER DEFAULT 5 CHECK(importance >= 1 AND importance <= 10),
  tags TEXT,                                 -- JSON array
  embedding BLOB,                            -- Vector embedding
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER,
  access_count INTEGER DEFAULT 0,
  last_accessed_at INTEGER,
  metadata TEXT                              -- JSON for extensibility
);

-- Full-text search
CREATE VIRTUAL TABLE memory_fts USING fts5(
  content,
  context,
  tags,
  content='memory_entries',
  content_rowid='id'
);

-- Access logging for analytics
CREATE TABLE memory_access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memory_id INTEGER NOT NULL,
  accessed_at INTEGER NOT NULL,
  access_type TEXT NOT NULL,                 -- search|direct|context
  relevance_score REAL,
  query_text TEXT,
  FOREIGN KEY (memory_id) REFERENCES memory_entries(id) ON DELETE CASCADE
);

-- Daily summaries
CREATE TABLE daily_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT UNIQUE NOT NULL,                 -- YYYY-MM-DD
  summary TEXT,
  key_events TEXT,                           -- JSON array
  created_at INTEGER NOT NULL
);

-- Telegram pairing
CREATE TABLE telegram_users (
  id INTEGER PRIMARY KEY,                    -- Telegram user ID
  username TEXT,
  paired_at INTEGER NOT NULL,
  last_message_at INTEGER,
  message_count INTEGER DEFAULT 0
);

-- Pending approvals
CREATE TABLE pending_approvals (
  id TEXT PRIMARY KEY,                       -- UUID
  type TEXT NOT NULL,                        -- soul_update|pairing|action
  payload TEXT NOT NULL,                     -- JSON
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  status TEXT DEFAULT 'pending'              -- pending|approved|denied|expired
);

-- Indexes
CREATE INDEX idx_memory_type ON memory_entries(entry_type);
CREATE INDEX idx_memory_importance ON memory_entries(importance DESC);
CREATE INDEX idx_memory_hash ON memory_entries(content_hash);
CREATE INDEX idx_memory_expires ON memory_entries(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_access_memory ON memory_access_log(memory_id);
CREATE INDEX idx_access_time ON memory_access_log(accessed_at DESC);
CREATE INDEX idx_approvals_status ON pending_approvals(status) WHERE status = 'pending';
```

---

## Configuration

```typescript
interface MudpuppyConfig {
  version: string;

  telegram: {
    enabled: boolean;
    botToken?: string;          // Or via TELEGRAM_BOT_TOKEN env
    allowGroups: boolean;
  };

  memory: {
    embeddingProvider: 'openai' | 'local' | 'none';
    embeddingModel?: string;
    hybridWeights: {
      vector: number;           // default: 0.7
      keyword: number;          // default: 0.3
    };
    autoIndex: boolean;
    indexInterval: number;      // milliseconds
  };

  heartbeat: {
    enabled: boolean;
    interval: number;           // milliseconds, default: 1800000 (30 min)
    activeHours?: {
      start: string;            // "09:00"
      end: string;              // "23:00"
      timezone: string;         // "America/Los_Angeles"
    };
    maxActionsPerBeat: number;  // safety limit
    requireApproval: boolean;
  };

  security: {
    approvalRequired: string[]; // tool names requiring approval
    auditLog: boolean;
    maxMessageLength: number;
  };
}
```

**Default config.json:**
```json
{
  "version": "2.0.0",
  "telegram": {
    "enabled": false,
    "allowGroups": false
  },
  "memory": {
    "embeddingProvider": "local",
    "embeddingModel": "all-MiniLM-L6-v2",
    "hybridWeights": { "vector": 0.7, "keyword": 0.3 },
    "autoIndex": true,
    "indexInterval": 5000
  },
  "heartbeat": {
    "enabled": false,
    "interval": 1800000,
    "maxActionsPerBeat": 5,
    "requireApproval": true
  },
  "security": {
    "approvalRequired": ["soul_propose_update"],
    "auditLog": true,
    "maxMessageLength": 4096
  }
}
```

---

## Development Phases

### Phase 0: Foundation (MCP Server Skeleton)

**Objective:** Create MCP server infrastructure and basic tooling.

**Tasks:**
- Initialize TypeScript project with MCP SDK
- Create MCP server skeleton with tool registration
- Implement config system (JSON-based, environment-aware)
- Create CLI for setup and management
- Set up workspace directory structure
- Implement logging and error handling

**Deliverables:**
- `src/mcp-server.ts` - MCP server entry point
- `src/config.ts` - Configuration manager
- `src/cli/index.ts` - CLI commands
- `src/tools/index.ts` - Tool registry

**Acceptance Criteria:**
- [ ] MCP server starts and registers with Claude Code
- [ ] `mudpuppy init` creates workspace structure
- [ ] `mudpuppy config get/set` works
- [ ] Config loads from `~/.mudpuppy/config.json`
- [ ] All paths use `$MUDPUPPY_HOME` or `~`
- [ ] `npm run build` succeeds
- [ ] Basic tests pass

**Testing:**
- Unit: Config loading, path resolution
- Integration: MCP server registration
- Manual: CLI commands work

---

### Phase 1: Telegram Tools

**Objective:** Implement Telegram integration as MCP tools.

**Tasks:**
- Create Telegram bot daemon (grammY)
- Implement IPC between MCP server and bot (Unix socket or HTTP)
- Implement `telegram_poll` tool
- Implement `telegram_send` tool
- Implement `telegram_pair` tool (with approval flow)
- Implement `telegram_status` tool
- Store paired users in SQLite
- Create bot management CLI commands

**Deliverables:**
- `src/telegram/bot.ts` - Bot daemon
- `src/telegram/ipc.ts` - IPC client for MCP server
- `src/tools/telegram.ts` - Telegram MCP tools
- Bot start/stop scripts

**Acceptance Criteria:**
- [ ] Bot starts as daemon via `mudpuppy telegram start`
- [ ] `telegram_poll` returns pending messages
- [ ] `telegram_send` delivers messages successfully
- [ ] `telegram_pair` triggers approval flow
- [ ] `telegram_status` returns accurate stats
- [ ] Messages from unpaired users are rejected
- [ ] Bot token stored securely (not in git)
- [ ] Bot survives restarts

**Testing:**
- Unit: Each tool in isolation (mocked bot)
- Integration: Tool → Bot → Telegram roundtrip
- Manual: Send messages from phone, verify delivery

---

### Phase 2: Memory Tools

**Objective:** Implement memory persistence with hybrid search.

**Tasks:**
- Set up SQLite database with schema
- Implement content hash deduplication
- Implement `memory_add` tool
- Implement `memory_search` tool with hybrid search
- Implement `memory_get` tool
- Implement `memory_stats` tool
- Implement access logging
- Add embedding support (OpenAI or local)
- File watcher for markdown files
- Daily log auto-creation

**Deliverables:**
- `src/memory/db.ts` - Database operations
- `src/memory/search.ts` - Hybrid search engine
- `src/memory/embeddings.ts` - Embedding generation
- `src/tools/memory.ts` - Memory MCP tools
- Database migration scripts

**Acceptance Criteria:**
- [ ] `memory_add` creates entries with all metadata
- [ ] Duplicate content returns existing entry (deduplication works)
- [ ] `memory_search` returns relevant results in <500ms
- [ ] Hybrid search combines vector + keyword scores
- [ ] Access logging records every retrieval
- [ ] `memory_stats` returns accurate statistics
- [ ] File changes auto-indexed
- [ ] Daily log created on first activity each day

**Testing:**
- Unit: Search algorithm, deduplication, scoring
- Integration: Add → Search → Verify
- Performance: 10,000 entries, verify speed
- Deduplication: Add same content twice

---

### Phase 3: Soul/Identity Tools

**Objective:** Implement personality persistence.

**Tasks:**
- Create default templates (SOUL.md, IDENTITY.md, AGENTS.md, USER.md)
- Implement `soul_read` tool
- Implement `soul_propose_update` tool with approval
- Create first-run initialization flow
- Implement file watching for manual edits
- Create approval UI (terminal-based)

**Deliverables:**
- `src/soul/files.ts` - File operations
- `src/soul/templates.ts` - Default templates
- `src/tools/soul.ts` - Soul MCP tools
- `src/approval/manager.ts` - Approval flow
- Template files

**Acceptance Criteria:**
- [ ] First run creates all bootstrap files
- [ ] `soul_read` returns file contents
- [ ] `soul_propose_update` creates pending approval
- [ ] Approval shows diff before accepting
- [ ] Manual file edits detected and respected
- [ ] Approval can be given via CLI

**Testing:**
- Unit: File loading, diff generation
- Integration: Propose → Approve → Verify update
- Manual: Edit SOUL.md manually, verify agent sees changes

---

### Phase 4: Autonomy (Heartbeat)

**Objective:** Implement periodic self-initiated execution.

**Tasks:**
- Create heartbeat scheduler
- Implement HEARTBEAT.md parser
- Implement `heartbeat_status` tool
- Implement `heartbeat_pause/resume` tools
- Add active hours support
- Integrate with approval system
- Add Telegram notifications for heartbeat results
- Implement audit logging

**Deliverables:**
- `src/autonomy/scheduler.ts` - Heartbeat scheduler
- `src/autonomy/parser.ts` - HEARTBEAT.md parser
- `src/tools/heartbeat.ts` - Heartbeat MCP tools
- `src/audit/logger.ts` - Audit logging

**Acceptance Criteria:**
- [ ] Heartbeat triggers at configured interval
- [ ] Respects active hours configuration
- [ ] Parses unchecked tasks from HEARTBEAT.md
- [ ] Approval required for risky actions
- [ ] All actions logged to audit trail
- [ ] Pause/resume works via tools and CLI
- [ ] Telegram notification on completion (if configured)
- [ ] Failed heartbeat doesn't crash system

**Testing:**
- Unit: Parser, scheduler timing
- Integration: Full heartbeat cycle
- Edge cases: System restart, clock changes
- Security: Verify approval requirements

---

### Phase 5: Skill Layer & Polish

**Objective:** Add persona layer and finalize for production use.

**Tasks:**
- Create Claude Code skill that consumes MCP tools
- Skill injects personality context
- Skill defines common workflows
- Polish approval UI
- Complete documentation
- Create setup script for new machines
- Security audit
- Performance optimization

**Deliverables:**
- `~/.claude/skills/mudpuppy/SKILL.md`
- `setup.sh` - New machine setup script
- `README.md` - Complete documentation
- `docs/` - Module documentation

**Acceptance Criteria:**
- [ ] Skill loads and works with MCP tools
- [ ] Personality consistent across sessions
- [ ] Setup script works on fresh machine
- [ ] Documentation complete
- [ ] No hardcoded paths
- [ ] Security audit passed
- [ ] Performance targets met

**Testing:**
- Manual: Full workflow testing
- Portability: Test on fresh VM
- Security: Penetration testing
- Human validation: 1 week daily use

---

## Portability Checklist

For moving to a new VM:

**Automated (via setup.sh):**
- [ ] Create `~/.mudpuppy/` directory structure
- [ ] Install Node.js dependencies
- [ ] Build TypeScript
- [ ] Register MCP server with Claude Code
- [ ] Create skill symlink

**Manual:**
- [ ] Copy `~/.mudpuppy/workspace/` (soul files, memories)
- [ ] Copy `~/.mudpuppy/data/memory.db` (or start fresh)
- [ ] Create new Telegram bot token (or reuse)
- [ ] Create `secrets.env` with tokens
- [ ] Configure embedding API key (if using OpenAI)

**Setup Script:**
```bash
#!/bin/bash
# setup.sh - Initialize Mudpuppy on a new machine

set -e

MUDPUPPY_HOME="${MUDPUPPY_HOME:-$HOME/.mudpuppy}"

echo "🐾 Setting up Mudpuppy..."

# Check dependencies
command -v node >/dev/null || { echo "❌ Node.js required"; exit 1; }
command -v npm >/dev/null || { echo "❌ npm required"; exit 1; }

# Create directory structure
echo "📁 Creating workspace..."
mkdir -p "$MUDPUPPY_HOME"/{workspace,data,bot,tools,memory}

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build
echo "🔨 Building..."
npm run build

# Initialize database
echo "💾 Initializing database..."
node dist/cli/index.js db:init

# Create default config if not exists
if [ ! -f "$MUDPUPPY_HOME/config.json" ]; then
  echo "⚙️  Creating default config..."
  node dist/cli/index.js init
fi

# Prompt for Telegram token
echo ""
echo "🤖 Telegram Setup (optional)"
read -p "Enter Telegram bot token (or press Enter to skip): " TOKEN
if [ -n "$TOKEN" ]; then
  echo "TELEGRAM_BOT_TOKEN=$TOKEN" >> "$MUDPUPPY_HOME/secrets.env"
  node dist/cli/index.js config set telegram.enabled true
fi

# Register MCP server
echo "🔌 Registering MCP server with Claude Code..."
# TODO: Add MCP registration command

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Run 'mudpuppy telegram start' to start the bot"
echo "  2. Pair your Telegram account with /start"
echo "  3. Configure heartbeat with 'mudpuppy config set heartbeat.enabled true'"
echo ""
```

---

## Security Model

### Approval Requirements

| Action | Requires Approval |
|--------|-------------------|
| `soul_propose_update` | Always |
| `telegram_pair` | Always |
| Heartbeat file writes | Configurable |
| Heartbeat external commands | Always |
| Memory deletion | Never (logged only) |

### Audit Logging

All tool invocations logged to `~/.mudpuppy/data/audit.log`:

```json
{
  "timestamp": 1706889600000,
  "tool": "memory_add",
  "input": { "content": "...", "entryType": "fact" },
  "output": { "success": true, "id": 42 },
  "source": "telegram:123456",
  "duration_ms": 45
}
```

### Secret Management

- **Never in git**: `secrets.env`, `*.db`, `audit.log`
- **Environment variables**: `TELEGRAM_BOT_TOKEN`, `OPENAI_API_KEY`
- **No hardcoded paths**: All paths relative to `$MUDPUPPY_HOME`

---

## Success Metrics

1. **Memory works**: Search returns relevant results >90% of the time
2. **Identity persists**: Agent maintains consistent personality across sessions
3. **Telegram reliable**: Messages delivered within 2 seconds, 99% uptime
4. **Heartbeat accurate**: Executes within ±1 minute of scheduled time
5. **Portable**: Fresh VM setup in <10 minutes
6. **User satisfaction**: Daily use for 1+ week

---

## Migration from v1

If you have existing v1 setup:

1. **Keep workspace files**: `SOUL.md`, `IDENTITY.md`, etc. are compatible
2. **Recreate config**: v2 config structure is different
3. **No memory migration**: v2 uses different schema, start fresh or write migration script
4. **Remove old skill**: Delete `~/.claude/skills/mudpuppy/` and reinstall

---

## Appendix

### Tool Manifest Template

`~/.mudpuppy/tools/manifest.md`:

```markdown
# Mudpuppy Tools

## Telegram
| Tool | Purpose | Requires Approval |
|------|---------|-------------------|
| telegram_poll | Get pending messages | No |
| telegram_send | Send message | No |
| telegram_pair | Approve pairing | Yes |
| telegram_status | Get bot status | No |

## Memory
| Tool | Purpose | Requires Approval |
|------|---------|-------------------|
| memory_search | Search memories | No |
| memory_add | Add new memory | No |
| memory_get | Get specific memory | No |
| memory_stats | Get statistics | No |

## Soul
| Tool | Purpose | Requires Approval |
|------|---------|-------------------|
| soul_read | Read soul/identity files | No |
| soul_propose_update | Propose soul change | Yes |

## Heartbeat
| Tool | Purpose | Requires Approval |
|------|---------|-------------------|
| heartbeat_status | Get heartbeat status | No |
| heartbeat_pause | Pause heartbeat | No |
| heartbeat_resume | Resume heartbeat | No |
```

### Entry Types Reference

| Type | Description | Example |
|------|-------------|---------|
| `fact` | Objective information | "User's favorite color is blue" |
| `preference` | User preferences | "Prefers concise responses" |
| `event` | Something that happened | "Deployed v2.0 on 2026-02-01" |
| `insight` | Learned patterns | "User tends to work late on Fridays" |
| `task` | Things to remember | "Follow up on PR review" |
| `relationship` | Entity connections | "Project X depends on Library Y" |

---

## Version History

- **v2.0** (2026-02-02): Complete rewrite with MCP-first architecture
- **v1.1** (2026-02-02): Added Phase 1.5 refactoring, atlas-agent patterns
- **v1.0** (2026-02-02): Initial PRD (skill-first approach)
