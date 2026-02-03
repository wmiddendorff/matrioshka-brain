# Mudpuppy v2.0.0

Security-hardened autonomous AI agent extending Claude Code with persistent memory, evolving personality, Telegram integration, and controlled autonomous execution.

Named after the aquatic salamander that never stops learning and evolving.

## Architecture

Mudpuppy uses an **MCP-first architecture**. All capabilities are exposed as MCP tools that Claude Code connects to via the Model Context Protocol. An optional skill layer adds persona and workflow on top.

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
│   ~/.mudpuppy   │
│   (workspace)   │
└─────────────────┘
```

## Quick Start

### Automated Setup

```bash
git clone <repo-url> mudpuppy
cd mudpuppy
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
    "mudpuppy": {
      "command": "node",
      "args": ["<absolute-path-to>/dist/mcp-server.js"],
      "env": {
        "MUDPUPPY_HOME": "<home-dir>/.mudpuppy"
      }
    }
  }
}
```

Open the project in Claude Code. The MCP server starts automatically.

## MCP Tools

16 tools across 5 categories:

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

## CLI Commands

```bash
mudpuppy init                        # Initialize workspace at ~/.mudpuppy
mudpuppy config get [path]           # Read config (e.g., "heartbeat.enabled")
mudpuppy config set <path> <value>   # Update config
mudpuppy status                      # Show system status

mudpuppy telegram start              # Start bot daemon
mudpuppy telegram stop               # Stop bot daemon
mudpuppy telegram restart            # Restart bot daemon
mudpuppy telegram status             # Check daemon status
mudpuppy telegram set-token          # Set bot token (interactive)

mudpuppy soul list                   # List pending soul update proposals
mudpuppy soul show <id>              # Show proposal with diff
mudpuppy soul approve <id>           # Approve a soul update
mudpuppy soul deny <id>              # Deny a soul update

mudpuppy heartbeat status            # Show scheduler status
mudpuppy heartbeat pause             # Pause heartbeat
mudpuppy heartbeat resume            # Resume heartbeat
```

If not installed globally, use `node dist/cli/index.js` instead of `mudpuppy`.

## Workspace Structure

```
~/.mudpuppy/
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

## Skill Setup

The optional skill layer gives the agent a persistent persona. To install:

1. Copy `skills/mudpuppy/SKILL.md` to `~/.claude/skills/mudpuppy/SKILL.md`
2. The skill activates automatically when Claude Code detects it

The skill instructs Claude to:
- Load personality from SOUL.md at session start
- Handle Telegram messages with consistent persona
- Search memory before answering context questions
- Store new facts as they come up
- Propose soul updates for meaningful personality growth

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

Mudpuppy follows a **security-first** design:

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
