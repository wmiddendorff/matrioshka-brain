# Telegram Integration

> **Status:** Not yet implemented (Phase 1)
>
> This document describes the planned MCP tool-based Telegram integration.
> The previous v1 skill-based implementation was archived during the v2 refactoring.

## Overview

Telegram integration enables remote interaction with the Mudpuppy agent through Telegram's Bot API. The v2 architecture uses MCP tools for capabilities with an optional skill layer for persona/workflow.

- **Library**: grammY (modern Telegram Bot API framework)
- **Architecture**: MCP tools + daemon process
- **Authentication**: DM pairing system with local approval
- **Security**: Approval-first, paired users only

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Telegram API   │◄───►│  Bot Daemon      │◄───►│  MCP Server │
│                 │     │  (background)    │     │  (tools)    │
└─────────────────┘     └──────────────────┘     └─────────────┘
                              │
                              ▼
                        Unix Socket IPC
```

### Components

1. **Bot Daemon** (`mudpuppy telegram start`)
   - Long-running background process
   - Connects to Telegram API via grammY
   - Queues incoming messages to JSONL file
   - Sends outgoing messages from response queue
   - Communicates with MCP server via Unix socket

2. **MCP Tools** (exposed to Claude Code)
   - `telegram_poll` - Retrieve pending messages
   - `telegram_send` - Send a message to a user
   - `telegram_pair` - Initiate pairing approval flow
   - `telegram_status` - Get bot status and stats

3. **Skill Layer** (optional, Phase 5)
   - Defines persona and workflow
   - Automatically polls and responds
   - Personality injection

## Planned MCP Tools

### `telegram_poll`

Retrieve pending messages from the queue.

```typescript
// Input
{
  limit?: number;  // Max messages to return (default: 10)
  clear?: boolean; // Clear messages after reading (default: true)
}

// Output
{
  messages: Array<{
    id: string;
    userId: number;
    username?: string;
    text: string;
    timestamp: string;
    chatType: 'private' | 'group';
  }>;
  remaining: number;
}
```

### `telegram_send`

Send a message to a Telegram user.

```typescript
// Input
{
  userId: number;
  text: string;
  parseMode?: 'HTML' | 'Markdown';
  replyToMessageId?: number;
}

// Output
{
  success: boolean;
  messageId?: number;
  error?: string;
}
```

### `telegram_pair`

Initiate or approve a pairing request.

```typescript
// Input
{
  action: 'list' | 'approve' | 'revoke';
  userId?: number;  // Required for approve/revoke
}

// Output
{
  success: boolean;
  pairedUsers?: number[];
  pendingRequests?: Array<{
    userId: number;
    username: string;
    requestedAt: string;
  }>;
}
```

### `telegram_status`

Get bot status and statistics.

```typescript
// Input
{}

// Output
{
  running: boolean;
  uptime?: number;  // seconds
  pairedUsers: number;
  pendingMessages: number;
  lastActivity?: string;
}
```

## CLI Commands

```bash
# Bot management
mudpuppy telegram start     # Start bot daemon
mudpuppy telegram stop      # Stop bot daemon
mudpuppy telegram status    # Show bot status

# Configuration
mudpuppy telegram set-token <token>  # Set bot token (stored in secrets.env)
mudpuppy telegram enable             # Enable Telegram integration
mudpuppy telegram disable            # Disable Telegram integration

# Pairing
mudpuppy telegram pair list          # List paired users
mudpuppy telegram pair approve <id>  # Approve pending request
mudpuppy telegram pair revoke <id>   # Revoke user access
```

## Security

### Pairing System

1. User sends `/start` to bot
2. Bot queues pairing request
3. Local approval required via CLI or tool
4. Approved users stored in config
5. Only paired users can send messages

### Token Storage

Bot token stored in `~/.mudpuppy/secrets.env`:

```env
TELEGRAM_BOT_TOKEN=123456789:ABC-DEFgh...
```

This file is:
- Never committed to git
- Readable only by owner
- Loaded by bot daemon at startup

## File Locations

```
~/.mudpuppy/
├── bot/
│   ├── telegram.pid      # Daemon PID file
│   └── telegram.sock     # Unix socket for IPC
├── telegram-queue.jsonl  # Incoming message queue
├── telegram-responses.jsonl  # Outgoing message queue
└── secrets.env           # Bot token (gitignored)
```

## Implementation Status

- [ ] Bot daemon with grammY
- [ ] Unix socket IPC
- [ ] Message queue (JSONL)
- [ ] `telegram_poll` tool
- [ ] `telegram_send` tool
- [ ] `telegram_pair` tool
- [ ] `telegram_status` tool
- [ ] CLI commands
- [ ] Pairing flow with approval

## See Also

- [PRD.md](../../PRD.md) - Full requirements
- [PROGRESS.md](../../PROGRESS.md) - Implementation progress
