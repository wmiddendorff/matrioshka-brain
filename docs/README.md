# Mudpuppy Documentation

This directory contains comprehensive documentation for all modules and systems in Mudpuppy.

## Architecture

Mudpuppy v2 uses an **MCP-first architecture**:
- All capabilities exposed as MCP tools
- Claude Code connects via MCP protocol
- Optional skill layer for persona/workflow

```
┌─────────────────┐
│   Claude Code   │
└────────┬────────┘
         │ MCP Protocol
         ▼
┌─────────────────┐     ┌──────────────────┐
│   MCP Server    │◄───►│  Bot Daemon      │
│   (tools)       │     │  (Telegram)      │
└────────┬────────┘     └──────────────────┘
         │
         ▼
┌─────────────────┐
│   ~/.mudpuppy   │
│   (workspace)   │
└─────────────────┘
```

## Documentation Structure

Each module has its own directory with detailed documentation:

- **[config/](./config/)** - Configuration system and settings management
- **[telegram/](./telegram/)** - Telegram bot integration (Phase 1)
- **[memory/](./memory/)** - Memory persistence, hybrid search, embeddings (Phase 2)
- **[soul/](./soul/)** - Soul/Identity system, bootstrap files (Phase 3)
- **[autonomy/](./autonomy/)** - Heartbeat engine, cron scheduling (Phase 4)
- **[tools/](./tools/)** - Agent tools and tool registry
- **[security/](./security/)** - Approval system, audit logging (Phase 5)
- **[architecture/](./architecture/)** - Overall system architecture and design decisions

## Documentation Standards

Each module directory should contain:

1. **README.md** - Overview, purpose, and quick start
2. **API.md** - Public API documentation with examples
3. **IMPLEMENTATION.md** - Implementation details and internals
4. **TESTING.md** - Testing strategy and test cases
5. **DECISIONS.md** - Architectural decisions and rationale

## When to Update Documentation

Documentation must be updated during development, not after:

- **During implementation**: Document as you build
- **When adding features**: Update API.md with new interfaces
- **When making decisions**: Log in DECISIONS.md
- **When writing tests**: Document test strategy in TESTING.md
- **Before phase completion**: Review and finalize all docs

## Documentation Guidelines

### Writing Style
- Clear and concise
- Use code examples
- Include diagrams where helpful (ASCII art is fine)
- Link to related docs
- Keep it up to date

### Code Examples
- Should be runnable
- Include imports
- Show expected output
- Cover common use cases

### Internal vs External
- Internal: Implementation details, performance notes, gotchas
- External: Public API, usage examples, configuration

## Module Status

| Module | Phase | Code Status | Docs Status |
|--------|-------|-------------|-------------|
| Config | Phase 0 | ✅ Implemented | ✅ Updated |
| MCP Server | Phase 0 | ✅ Implemented | ⬜ Not started |
| Tools Registry | Phase 0 | ✅ Implemented | ⬜ Not started |
| Telegram | Phase 1 | ✅ Implemented | 🔄 Planned (README only) |
| Memory | Phase 2 | ✅ Complete | ✅ Updated |
| Soul | Phase 3 | ⬜ Not started | ⬜ Not started |
| Autonomy | Phase 4 | ⬜ Not started | ⬜ Not started |
| Security | Phase 5 | ⬜ Not started | ⬜ Not started |

## Current Source Files

```
src/
├── index.ts          # Main exports
├── config.ts         # Configuration manager
├── secrets.ts        # Secrets manager
├── mcp-server.ts     # MCP server entry point
├── cli/
│   └── index.ts      # CLI commands
├── tools/
│   ├── index.ts      # Tool registry (config_get, config_set)
│   ├── telegram.ts   # Telegram MCP tools (4 tools)
│   └── memory.ts     # Memory MCP tools (5 tools)
├── telegram/
│   ├── index.ts      # Module re-exports
│   ├── types.ts      # Telegram type definitions
│   ├── protocol.ts   # IPC protocol
│   ├── daemon.ts     # Daemon lifecycle
│   ├── ipc.ts        # IPC client
│   └── bot.ts        # Telegram bot daemon
└── memory/
    ├── index.ts      # Module re-exports
    ├── types.ts      # Memory type definitions
    ├── db.ts         # SQLite schema + CRUD + search primitives
    ├── embeddings.ts # Local embedding generation
    ├── search.ts     # Hybrid search algorithm
    ├── daily-log.ts  # Daily markdown log files
    └── indexer.ts    # File auto-indexer (fs.watch + polling)
```

## Quick Links

- [Main README](../README.md)
- [PRD](../PRD.md)
- [PROGRESS](../PROGRESS.md)
- [CLAUDE.md](../CLAUDE.md)
