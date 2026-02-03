# Telegram Integration

> **Status:** Complete (Phase 1)

## Overview

Telegram integration enables remote interaction with the Mudpuppy agent through Telegram's Bot API. The architecture uses a background daemon process that communicates with MCP tools over Unix socket IPC.

- **Library**: grammY (modern Telegram Bot API framework)
- **Architecture**: MCP tools + daemon process + SQLite queue
- **Authentication**: DM pairing system with local approval
- **Security**: Paired users only, approval-first

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Telegram API   │◄───►│  Bot Daemon      │◄───►│  MCP Server │
│                 │     │  (background)    │     │  (tools)    │
└─────────────────┘     └──────────────────┘     └─────────────┘
                              │
                              ▼
                        ┌──────────────┐
                        │  SQLite DB   │
                        │  (queue +    │
                        │   pairings)  │
                        └──────────────┘
                              │
                        Unix Socket IPC
```

### Components

1. **Bot Daemon** (`src/telegram/bot.ts`)
   - Long-running background process started via `mudpuppy telegram start`
   - Connects to Telegram API via grammY
   - Queues incoming messages to SQLite
   - Serves IPC requests over Unix socket
   - Handles `/start`, `/help`, `/status` commands
   - Signals readiness with `DAEMON_READY` on stdout

2. **IPC Protocol** (`src/telegram/protocol.ts`)
   - Newline-delimited JSON over Unix socket
   - Request/response with UUID correlation
   - Methods: `ping`, `status`, `poll`, `send`, `pair`

3. **IPC Client** (`src/telegram/ipc.ts`)
   - Used by MCP tools to communicate with daemon
   - 5-second default timeout per request
   - High-level functions: `ping()`, `getStatus()`, `pollMessages()`, `sendMessage()`, `managePairings()`

4. **Daemon Manager** (`src/telegram/daemon.ts`)
   - PID file management (`bot/telegram.pid`)
   - Start/stop/restart lifecycle
   - Stale PID detection and cleanup
   - Development mode (tsx) and production mode (node) support

5. **MCP Tools** (`src/tools/telegram.ts`)
   - `telegram_status` — Get bot daemon status
   - `telegram_poll` — Retrieve pending messages
   - `telegram_send` — Send a message to a paired user
   - `telegram_pair` — Manage user pairings (list/approve/deny/revoke)

## Quick Start

```bash
# 1. Initialize workspace
mudpuppy init

# 2. Set bot token (stored in secrets.env)
mudpuppy telegram set-token <your-bot-token>

# 3. Start the daemon
mudpuppy telegram start

# 4. Have a user send /start to your bot on Telegram

# 5. Approve the pairing (via MCP tool or CLI)
# telegram_pair { action: "list" }
# telegram_pair { action: "approve", userId: 12345 }

# 6. Poll for messages
# telegram_poll {}

# 7. Send a reply
# telegram_send { userId: 12345, text: "Hello from Mudpuppy!" }
```

## CLI Commands

```bash
# Bot management
mudpuppy telegram start       # Start bot daemon
mudpuppy telegram stop        # Stop bot daemon
mudpuppy telegram restart     # Restart bot daemon
mudpuppy telegram status      # Show bot status

# Configuration
mudpuppy telegram set-token <token>  # Set bot token (stored in secrets.env)
```

## Security

### Pairing System

1. User sends `/start` to bot on Telegram
2. Bot creates a pending pairing request in SQLite
3. Local approval required via MCP tool or CLI
4. Approved users stored in `telegram_users` table
5. Only paired users can send messages
6. Unpaired users receive a prompt to use `/start`

### Token Storage

Bot token stored in `~/.mudpuppy/secrets.env`:

```env
TELEGRAM_BOT_TOKEN=123456789:ABC-DEFgh...
```

This file is never committed to git and is readable only by the owner.

## Database

All Telegram state stored in `~/.mudpuppy/data/telegram.db` (SQLite with WAL mode):

- `telegram_users` — Paired users with message counts
- `telegram_messages` — Message queue with read/unread tracking
- `pending_approvals` — Pairing request queue

## File Locations

```
~/.mudpuppy/
├── bot/
│   ├── telegram.pid      # Daemon PID file
│   ├── telegram.sock     # Unix socket for IPC
│   └── telegram.log      # Daemon log output
├── data/
│   └── telegram.db       # SQLite message queue + pairings
└── secrets.env           # Bot token (gitignored)
```

## Source Files

```
src/telegram/
├── index.ts      # Module re-exports
├── types.ts      # Type definitions (TelegramMessage, BotStatus, etc.)
├── protocol.ts   # IPC request/response format
├── daemon.ts     # Daemon lifecycle management
├── ipc.ts        # Unix socket client
└── bot.ts        # grammY bot daemon (entry point)

src/tools/
└── telegram.ts   # 4 MCP tool registrations
```

## Related Documentation

- [API Reference](./API.md)
- [Implementation Details](./IMPLEMENTATION.md)
- [Testing Strategy](./TESTING.md)
