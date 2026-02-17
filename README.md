# Matrioshka Brain v2.0.0

[![CI](https://github.com/wmiddendorff/matrioshka-brain/actions/workflows/ci.yml/badge.svg)](https://github.com/wmiddendorff/matrioshka-brain/actions/workflows/ci.yml)

Security-hardened autonomous AI agent extending Claude Code with persistent memory, evolving personality, Telegram integration, and controlled autonomous execution.

Named after the matrioshka brain megastructure from Charles Stross's *Accelerando* — nested layers of computation that grow ever more capable.

## Architecture

Matrioshka Brain uses an **MCP-first architecture**. All capabilities are exposed as MCP tools that Claude Code connects to via the Model Context Protocol. An optional skill layer adds persona and workflow on top.

```
┌─────────────────┐
│   Claude Code   │
│   + SKILL.md    │  ← optional persona layer
└────────┬────────┘
         │ MCP Protocol (stdio)
         ▼
┌─────────────────┐     ┌──────────────────┐
│   MCP Server    │◄───►│  Bot Daemon      │
│   (16 tools)    │ IPC │  (Telegram)      │
└────────┬────────┘     └──────────────────┘
         │
         ▼
┌─────────────────┐
│   ~/.matrioshka-brain   │
│   (workspace)   │
└─────────────────┘
```

## Quick Start

### Automated Setup

```bash
git clone <repo-url> matrioshka-brain
cd matrioshka-brain
./setup.sh
```

The setup script installs dependencies, builds the project, initializes the workspace, and generates your `.mcp.json`.

### Manual Setup

```bash
npm install
npm run build
node dist/cli/index.js init
```

Then create `.mcp.json` in the project root (see `.mcp.json.example` for the template):

```json
{
  "mcpServers": {
    "matrioshka-brain": {
      "command": "node",
      "args": ["<absolute-path-to>/dist/mcp-server.js"],
      "env": {
        "MATRIOSHKA_BRAIN_HOME": "<home-dir>/.matrioshka-brain"
      }
    }
  }
}
```

Open the project in Claude Code. The MCP server starts automatically.

## MCP Tools

23 tools across 6 categories:

| Tool | Category | Description |
|------|----------|-------------|
| `config_get` | Config | Read configuration values (dot-notation) |
| `config_set` | Config | Update configuration values |
| `telegram_status` | Telegram | Check bot daemon connection state |
| `telegram_poll` | Telegram | Get pending messages from paired users |
| `telegram_send` | Telegram | Send message to a paired user (HTML format) |
| `telegram_pair` | Telegram | List/approve/deny/revoke user pairings |
| `memory_add` | Memory | Store a memory entry with metadata and embeddings |
| `memory_search` | Memory | Hybrid search (vector + keyword) across memories |
| `memory_get` | Memory | Retrieve a memory entry by ID |
| `memory_stats` | Memory | Get memory database statistics |
| `memory_delete` | Memory | Delete a memory entry |
| `soul_read` | Soul | Read soul/identity/agents/user bootstrap files |
| `soul_propose_update` | Soul | Propose personality changes (requires approval) |
| `heartbeat_status` | Heartbeat | Check autonomous scheduler status |
| `heartbeat_pause` | Heartbeat | Pause autonomous execution |
| `heartbeat_resume` | Heartbeat | Resume autonomous execution |
| `plugins_list` | Plugins | List installed plugins |
| `plugins_add` | Plugins | Add and configure a new plugin |
| `plugins_remove` | Plugins | Remove an installed plugin |
| `plugins_status` | Plugins | Get detailed status for a plugin |
| `plugins_update` | Plugins | Update plugin configuration |
| `plugins_available` | Plugins | List available plugin definitions |
| `plugins_generate_config` | Plugins | Generate .mcp.json for installed plugins |

## CLI Commands

```bash
matrioshka-brain init                        # Initialize workspace at ~/.matrioshka-brain
matrioshka-brain config get [path]           # Read config (e.g., "heartbeat.enabled")
matrioshka-brain config set <path> <value>   # Update config
matrioshka-brain status                      # Show system status

matrioshka-brain telegram start              # Start bot daemon
matrioshka-brain telegram stop               # Stop bot daemon
matrioshka-brain telegram restart            # Restart bot daemon
matrioshka-brain telegram status             # Check daemon status
matrioshka-brain telegram set-token          # Set bot token (interactive)

matrioshka-brain soul list                   # List pending soul update proposals
matrioshka-brain soul show <id>              # Show proposal with diff
matrioshka-brain soul approve <id>           # Approve a soul update
matrioshka-brain soul deny <id>              # Deny a soul update

matrioshka-brain heartbeat status            # Show scheduler status
matrioshka-brain heartbeat pause             # Pause heartbeat
matrioshka-brain heartbeat resume            # Resume heartbeat

matrioshka-brain plugins list                # List installed plugins
matrioshka-brain plugins available           # List available plugins
matrioshka-brain plugins add <name>          # Add a plugin (interactive)
matrioshka-brain plugins remove <name>       # Remove a plugin
matrioshka-brain plugins status <name>       # Show plugin status
matrioshka-brain plugins config              # Generate .mcp.json configuration

matrioshka-brain schedule list               # List scheduled tasks
matrioshka-brain schedule add                # Add scheduled task (interactive)
matrioshka-brain schedule remove <id>        # Remove a task
matrioshka-brain schedule status <id>        # Show task status
matrioshka-brain schedule enable <id>        # Enable a task
matrioshka-brain schedule disable <id>       # Disable a task

matrioshka-brain web start [--port 3456]     # Start management console
matrioshka-brain web stop                    # Stop console
matrioshka-brain web restart                 # Restart console
matrioshka-brain web status                  # Show console status
```

If not installed globally, use `node dist/cli/index.js` instead of `matrioshka-brain`.

## Workspace Structure

```
~/.matrioshka-brain/
├── workspace/              # Agent bootstrap files
│   ├── SOUL.md            # Personality and communication style
│   ├── IDENTITY.md        # Name, emoji, vibe
│   ├── AGENTS.md          # Operating instructions and safety rules
│   ├── USER.md            # User profile
│   ├── HEARTBEAT.md       # Autonomous task list
│   └── memory/            # Daily logs (YYYY-MM-DD.md)
├── data/
│   ├── memory.db          # SQLite + sqlite-vec + FTS5
│   ├── approvals.db       # Pending approvals
│   └── audit.log          # JSONL audit trail
├── config.json            # Configuration
└── secrets.env            # Bot token, API keys (never committed)
```

## Skills & Profiles

Matrioshka Brain supports multiple pre-configured profiles for different use cases.

### Sales Assistant Profile

Specialized profile for sales professionals with:
- Pipedrive CRM integration
- Email management (Gmail/Outlook)
- Calendar integration
- Autonomous pipeline monitoring
- Follow-up reminders
- Meeting prep automation

**Quick setup:**
```bash
./setup.sh --profile sales
```

This installs:
- Sales-optimized SOUL.md, AGENTS.md, HEARTBEAT.md
- Pre-configured plugin definitions (Pipedrive, Gmail, Google Calendar)
- Sales assistant skill profile

See `skills/sales-assistant/SKILL.md` for detailed workflows.

### Default Profile

The optional skill layer gives the agent a persistent persona. To install:

1. Copy `skills/matrioshka-brain/SKILL.md` to `~/.claude/skills/matrioshka-brain/SKILL.md`
2. The skill activates automatically when Claude Code detects it

The skill instructs Claude to:
- Load personality from SOUL.md at session start
- Handle Telegram messages with consistent persona
- Search memory before answering context questions
- Store new facts as they come up
- Propose soul updates for meaningful personality growth

## Plugins

Matrioshka Brain supports external MCP server integrations via a plugin system. Pre-built plugins:

| Plugin | Description | Required Credentials |
|--------|-------------|---------------------|
| gmail | Google Workspace (Gmail + Calendar) | OAuth Client ID & Secret |
| outlook | Microsoft 365 (Outlook + Calendar) | Azure App Registration |
| pipedrive | Pipedrive CRM | API Token + Domain |

**Add a plugin:**
```bash
matrioshka-brain plugins add gmail
# Interactive prompt for OAuth credentials

matrioshka-brain plugins config
# Generates .mcp.json entries

# Add generated entries to your .mcp.json
```

Plugins integrate seamlessly with Claude Code's MCP protocol.

## Scheduler

For autonomous operation outside of active Claude Code sessions, Matrioshka Brain includes a cross-platform job scheduler:

- **macOS:** launchd (~/Library/LaunchAgents/)
- **Windows:** Task Scheduler
- **Linux:** cron

**Add a scheduled task:**
```bash
matrioshka-brain schedule add
# Interactive: name, schedule, command

# Example schedule formats:
# - "09:00" (daily at 9 AM)
# - "every 30 minutes" (interval)
```

The scheduler can trigger Claude Code/Codex runs for heartbeat tasks, enabling true autonomous operation.

## Web Management Console

A localhost-only web UI for configuration and monitoring (NOT a chat interface - MB runs inside Claude Code/Codex which provides the chat).

**Start the console:**
```bash
matrioshka-brain web start
# Open http://localhost:3456
```

**Features:**
- **Dashboard** - System status overview
- **Plugin Management** - Configure Gmail, Pipedrive, etc.
- **Schedule Manager** - View/edit autonomous tasks
- **Memory Browser** - Search and manage knowledge base
- **Soul File Editor** - Edit personality files (SOUL.md, etc.)
- **Telegram Pairing** - Approve/deny pairing requests
- **Audit Log Viewer** - Review autonomous actions

**Why no chat interface?** Matrioshka Brain already runs inside Claude Code/Codex - that's the chat interface with full MCP tool access. The web UI is purely for configuration and monitoring.

## Development

```bash
npm run build          # Compile TypeScript
npm run build:watch    # Watch mode
npm run test           # Run all tests (vitest)
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
npm run dev -- <cmd>   # Run CLI in dev mode (tsx)
npm run dev:mcp        # Run MCP server in dev mode
npm run clean          # Remove dist/
```

### Source Tree

```
src/
├── index.ts              # Main exports
├── config.ts             # Configuration manager (Zod schema)
├── secrets.ts            # Secrets manager (secrets.env)
├── mcp-server.ts         # MCP server entry point (stdio)
├── cli/
│   └── index.ts          # CLI commands (commander)
├── tools/
│   ├── index.ts          # Tool registry
│   ├── telegram.ts       # 4 Telegram tools
│   ├── memory.ts         # 5 Memory tools
│   ├── soul.ts           # 2 Soul tools
│   └── heartbeat.ts      # 3 Heartbeat tools
├── telegram/
│   ├── types.ts          # Type definitions
│   ├── protocol.ts       # IPC protocol (JSON over Unix socket)
│   ├── daemon.ts         # Daemon lifecycle (PID file)
│   ├── bot.ts            # grammY bot + socket server
│   ├── ipc.ts            # IPC client
│   └── index.ts          # Re-exports
├── memory/
│   ├── types.ts          # Type definitions
│   ├── db.ts             # SQLite schema, CRUD, search primitives
│   ├── embeddings.ts     # Local embeddings (all-MiniLM-L6-v2)
│   ├── search.ts         # Hybrid search algorithm
│   ├── daily-log.ts      # Daily markdown log files
│   ├── indexer.ts        # File auto-indexer (fs.watch + polling)
│   └── index.ts          # Re-exports
├── approval/
│   ├── types.ts          # Type definitions
│   ├── db.ts             # SQLite CRUD for approvals
│   └── index.ts          # Re-exports
├── soul/
│   ├── types.ts          # Type definitions
│   ├── templates.ts      # Default bootstrap file templates
│   ├── diff.ts           # LCS-based unified diff
│   ├── files.ts          # Soul file read/write
│   └── index.ts          # Re-exports
├── audit/
│   ├── logger.ts         # JSONL audit log
│   └── index.ts          # Re-exports
└── autonomy/
    ├── types.ts          # Type definitions
    ├── parser.ts         # HEARTBEAT.md parser
    ├── scheduler.ts      # HeartbeatScheduler
    └── index.ts          # Re-exports

tests/
├── config.test.ts        # 33 tests
├── telegram.test.ts      # 28 tests
├── memory.test.ts        # 33 tests
├── soul.test.ts          # 36 tests
├── autonomy.test.ts      # 42 tests
└── perf-10k.mjs          # Performance benchmark
```

## Security

Matrioshka Brain follows a **security-first** design:

- **Approval system** — Soul updates, Telegram pairings, and heartbeat actions require explicit human approval
- **Audit logging** — All autonomous actions logged to JSONL audit trail
- **Active hours** — Heartbeat respects configured time windows
- **Secrets management** — Tokens stored in `secrets.env`, never committed to git
- **Input validation** — All tool inputs validated with Zod schemas
- **Rate limiting** — `maxActionsPerBeat` prevents runaway autonomous execution
- **Isolation** — Telegram bot runs as a separate daemon process, IPC via Unix socket

See [docs/security/](./docs/security/) for the full security model.

## Documentation

| Module | Docs |
|--------|------|
| [Configuration](./docs/config/) | README, API, Implementation, Testing |
| [Telegram](./docs/telegram/) | README, API, Implementation, Testing |
| [Memory](./docs/memory/) | README, API, Implementation, Testing |
| [Soul/Identity](./docs/soul/) | README, API, Implementation, Testing |
| [Autonomy](./docs/autonomy/) | README, API, Implementation, Testing |
| [Security](./docs/security/) | README, API, Implementation, Testing |

## License

MIT
