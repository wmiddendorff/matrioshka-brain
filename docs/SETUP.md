# Matrioshka Brain Setup Guide

Complete guide from clone to fully autonomous AI agent.

## Prerequisites

- **Node.js** >= 18.x
- **npm** (comes with Node.js)
- **Claude Code** CLI installed and authenticated
- **Telegram Bot Token** (optional, for messaging integration)

### Getting a Telegram Bot Token (Optional)

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts
3. Save the token it gives you (format: `123456789:ABCdefGHI...`)

## Installation

### 1. Clone and Set Up

```bash
git clone <repository-url> matrioshka-brain
cd matrioshka-brain
./setup.sh
```

The setup script handles everything:
- Installs Node.js dependencies
- Builds the TypeScript project
- Initializes the workspace at `~/.matrioshka-brain/`
- Generates `.mcp.json` for Claude Code integration

### 2. Configure Telegram (Optional)

If you want the agent to communicate via Telegram:

```bash
# Set your bot token
node dist/cli/index.js telegram set-token <your-token>

# Enable Telegram in config
node dist/cli/index.js config set telegram.enabled true

# Start the bot daemon
node dist/cli/index.js telegram start

# Verify it's running
node dist/cli/index.js telegram status
```

#### Pairing Your Telegram Account

1. Open Telegram and message your bot
2. The bot will respond with a pairing request
3. Approve it from the CLI:

```bash
node dist/cli/index.js soul list    # See pending requests
node dist/cli/index.js soul approve <request-id>
```

Or approve it from within Claude Code when the agent detects the pending request.

### 3. Enable Autonomous Heartbeat

The heartbeat lets the agent act on its own at regular intervals (checking messages, reviewing tasks, etc.):

```bash
# Enable heartbeat (default: every 30 minutes)
node dist/cli/index.js config set heartbeat.enabled true

# Optional: Change interval (in milliseconds)
node dist/cli/index.js config set heartbeat.interval 900000  # 15 minutes

# Optional: Set active hours (agent only acts during this window)
node dist/cli/index.js config set heartbeat.activeHours '{"start":"07:00","end":"23:00","timezone":"America/New_York"}'
```

### 4. Verify Setup

```bash
node dist/cli/index.js status
```

You should see:
- Workspace: initialized
- Telegram: enabled/disabled
- Heartbeat: interval and status
- Audit Log: enabled

## First Conversation

This is where the agent comes alive.

### Open Claude Code in the Matrioshka Brain project directory:

```bash
cd matrioshka-brain
claude
```

Claude Code detects `.mcp.json` and automatically starts the MCP server, making all 16 Matrioshka Brain tools available.

### What Happens Automatically

On the first conversation, the agent will:

1. **Load its soul files** and detect that it's a fresh install (identity and user files are unpopulated)
2. **Introduce itself** as a new agent that's just getting started
3. **Ask about you** — your name, what you do, your projects, how you like to communicate
4. **Save everything it learns** to its memory database automatically
5. **Propose identity updates** to fill in its name and personality details

### What You Should Do

- Answer the agent's questions naturally
- Tell it about yourself, your work, your preferences
- Approve soul proposals when prompted:

```bash
# In another terminal
node dist/cli/index.js soul list
node dist/cli/index.js soul approve <proposal-id>
```

### After Setup

The agent is now autonomous. In subsequent sessions it will:

- **Remember you** — it loads your profile and searches memory at every session start
- **Save new information automatically** — personal details, decisions, interests, without being asked
- **Take initiative** — suggest actions, surface relevant context, anticipate needs
- **Evolve its personality** — propose soul updates as it learns how to work with you
- **Handle Telegram messages** — if configured, it checks and responds to messages
- **Execute heartbeat tasks** — periodic autonomous actions at the configured interval

## Architecture Overview

```
Claude Code
    |
    +-- .mcp.json (auto-detected)
    |
    +-- MCP Server (16 tools)
    |       |
    |       +-- Config tools (get/set)
    |       +-- Telegram tools (poll/send/pair/status)
    |       +-- Memory tools (add/search/get/stats/delete)
    |       +-- Soul tools (read/propose_update)
    |       +-- Heartbeat tools (status/pause/resume)
    |
    +-- SKILL.md (persona + workflow instructions)
    |
    +-- CLAUDE.md (behavioral protocol)
```

### Workspace Structure

```
~/.matrioshka-brain/
    config.json             # Global configuration
    secrets.env             # API keys and tokens (gitignored)
    workspace/
        SOUL.md             # Agent personality (evolves)
        IDENTITY.md         # Name, emoji, vibe
        AGENTS.md           # Operating instructions
        USER.md             # Your profile (populated by agent)
        MEMORY.md           # Curated long-term knowledge
        HEARTBEAT.md        # Autonomous task list
        memory/             # Daily logs
            YYYY-MM-DD.md
    data/
        memory.db           # SQLite + vector embeddings
        approvals.db        # Pending soul/pairing approvals
        audit.log           # JSONL audit trail
        sessions/           # Session transcripts
    tools/
        manifest.md         # Available tool documentation
```

## Configuration Reference

All configuration is in `~/.matrioshka-brain/config.json`. Use the CLI to modify:

```bash
node dist/cli/index.js config get              # Show full config
node dist/cli/index.js config get telegram      # Show section
node dist/cli/index.js config set <path> <val>  # Set value
```

### Key Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `telegram.enabled` | `false` | Enable Telegram integration |
| `memory.embeddingProvider` | `"local"` | Embedding provider (local, openai, gemini) |
| `memory.autoIndex` | `false` | Auto-index workspace files into memory |
| `heartbeat.enabled` | `false` | Enable autonomous heartbeat |
| `heartbeat.interval` | `1800000` | Heartbeat interval in ms (default: 30 min) |
| `heartbeat.requireApproval` | `true` | Require CLI approval for heartbeat actions |
| `heartbeat.maxActionsPerBeat` | `5` | Max tool calls per heartbeat tick |
| `heartbeat.activeHours` | `null` | Time window for autonomous activity |
| `security.auditLog` | `true` | Log all autonomous actions |

## CLI Quick Reference

```bash
# General
matrioshka-brain init               # Initialize workspace
matrioshka-brain status             # Show system status
matrioshka-brain version            # Show version

# Config
matrioshka-brain config get [path]          # Read config
matrioshka-brain config set <path> <value>  # Update config

# Telegram
matrioshka-brain telegram start             # Start bot daemon
matrioshka-brain telegram stop              # Stop bot daemon
matrioshka-brain telegram restart           # Restart bot daemon
matrioshka-brain telegram status            # Show bot status
matrioshka-brain telegram set-token <tok>   # Set bot token

# Soul Management
matrioshka-brain soul list                  # List pending proposals
matrioshka-brain soul show <id>             # Show proposal diff
matrioshka-brain soul approve <id>          # Apply proposal
matrioshka-brain soul deny <id>             # Reject proposal

# Heartbeat
matrioshka-brain heartbeat status           # Show scheduler state
```

**Note:** Replace `matrioshka-brain` with `node dist/cli/index.js` if you haven't set up a global alias.

## Troubleshooting

### MCP server not starting
- Verify `.mcp.json` exists and has correct paths
- Run `npm run build` to ensure the project is compiled
- Check that `dist/mcp-server.js` exists

### Agent doesn't remember things
- Verify memory database exists: `ls ~/.matrioshka-brain/data/memory.db`
- Check memory stats via MCP tool: `memory_stats`
- Ensure `CLAUDE.md` has the "Agent Behavior Protocol" section

### Telegram bot not responding
- Check daemon status: `matrioshka-brain telegram status`
- Verify token: ensure `TELEGRAM_BOT_TOKEN` is in `~/.matrioshka-brain/secrets.env`
- Check that the user is paired: `matrioshka-brain soul list`

### Heartbeat not firing
- Verify enabled: `matrioshka-brain config get heartbeat.enabled`
- Check active hours: heartbeat skips ticks outside the configured window
- Check HEARTBEAT.md has `@tool_name` prefixed tasks
- The heartbeat runs inside the MCP server process — Claude Code must be open

### Soul proposals not appearing
- List pending: `matrioshka-brain soul list`
- Proposals expire after 24 hours by default
- Check `~/.matrioshka-brain/data/approvals.db` exists

## Security Notes

- **Approval-first**: Soul updates, Telegram pairing, and heartbeat actions all require explicit user approval by default
- **Audit trail**: All autonomous actions are logged to `~/.matrioshka-brain/data/audit.log`
- **Secrets isolation**: Tokens and keys are stored in `~/.matrioshka-brain/secrets.env`, never in code or git
- **Active hours**: Prevents the agent from acting autonomously at inconvenient times
- **No auto-approve**: The agent cannot approve its own proposals or pair Telegram users without human consent

## Resetting the Agent

To start fresh with a blank agent:

```bash
# Remove workspace (keeps the project code)
rm -rf ~/.matrioshka-brain

# Re-initialize
./setup.sh
```

This creates a fresh workspace with blank templates. The agent will go through the onboarding flow again on first conversation.
