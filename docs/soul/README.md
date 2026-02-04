# Soul/Identity Module

Personality persistence via bootstrap files with an approval system for proposed changes.

## Overview

The soul module manages four bootstrap files that define the agent's personality, identity, operating instructions, and user context:

| File | Purpose | Agent Can Propose Updates |
|------|---------|--------------------------|
| `SOUL.md` | Core personality and behavioral guidelines | Yes |
| `IDENTITY.md` | Concrete identifiers (name, type, emoji) | No |
| `AGENTS.md` | Operating instructions and safety rules | Yes |
| `USER.md` | User profile information | No |

## Quick Start

```bash
# Initialize workspace (creates bootstrap files)
matrioshka-brain init

# Read a soul file via MCP tool
# soul_read { file: "soul" }

# Propose a change (creates pending approval)
# soul_propose_update { file: "soul", newContent: "...", reason: "..." }

# List pending proposals
matrioshka-brain soul list

# Review a proposal
matrioshka-brain soul show <id>

# Approve or deny
matrioshka-brain soul approve <id>
matrioshka-brain soul deny <id>
```

## Design Principles

1. **No caching** — `soul_read` always reads from disk so manual edits are instantly respected
2. **Approval required** — The agent cannot directly modify soul/agents files; changes go through a proposal+approval flow
3. **Unified diff** — Proposals include a human-readable diff for review
4. **Shared approval system** — The `approval/` module is reusable by Phase 4 (heartbeat) and Telegram pairing

## Architecture

```
┌──────────────┐     ┌───────────────┐     ┌─────────────────┐
│ MCP Tool:    │────►│ Soul Module   │────►│ Filesystem       │
│ soul_read    │     │ (files.ts)    │     │ workspace/*.md   │
└──────────────┘     └───────────────┘     └─────────────────┘

┌──────────────┐     ┌───────────────┐     ┌─────────────────┐
│ MCP Tool:    │────►│ Approval DB   │────►│ data/approvals.db│
│ soul_propose │     │ (approval/)   │     └─────────────────┘
└──────────────┘     └───────┬───────┘
                             │ CLI approve
                             ▼
                     ┌───────────────┐     ┌─────────────────┐
                     │ Soul Module   │────►│ workspace/*.md   │
                     │ (files.ts)    │     └─────────────────┘
                     └───────────────┘
```

## Files

### Source

- `src/soul/types.ts` — Type definitions and file name mapping
- `src/soul/templates.ts` — Default content for bootstrap files
- `src/soul/diff.ts` — LCS-based unified diff generator
- `src/soul/files.ts` — File read/write operations
- `src/soul/index.ts` — Module re-exports
- `src/approval/types.ts` — Approval type definitions
- `src/approval/db.ts` — SQLite CRUD for approvals
- `src/approval/index.ts` — Module re-exports
- `src/tools/soul.ts` — MCP tool definitions

### Workspace

- `~/.matrioshka-brain/workspace/SOUL.md`
- `~/.matrioshka-brain/workspace/IDENTITY.md`
- `~/.matrioshka-brain/workspace/AGENTS.md`
- `~/.matrioshka-brain/workspace/USER.md`
- `~/.matrioshka-brain/data/approvals.db`

## Related Documentation

- [API Reference](./API.md)
- [Implementation Details](./IMPLEMENTATION.md)
- [Testing Strategy](./TESTING.md)
