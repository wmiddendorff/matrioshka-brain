# Telegram Integration

The Telegram module provides remote interaction with the Mudpuppy agent through Telegram's Bot API, enabling remote testing, notifications, and message handling while away from the local machine.

## Overview

- **Library**: grammY (modern Telegram Bot API framework)
- **Authentication**: DM pairing system with local approval
- **Security**: Approval-first, paired users only
- **Features**: Commands, message routing, HTML formatting, session management

## Quick Start

### 1. Create a Telegram Bot

```bash
# On Telegram, message @BotFather
/newbot

# Follow prompts, save the token
# Token format: 123456789:ABC-DEFgh...
```

### 2. Configure Mudpuppy

```bash
# Set bot token
node dist/cli/index.js telegram set-token 123456789:ABC-DEFgh...

# Enable Telegram integration
node dist/cli/index.js telegram enable
```

### 3. Start the Bot

```bash
node dist/cli/index.js start
```

### 4. Pair from Telegram

1. Find your bot on Telegram (search by username)
2. Send `/start`
3. Approve the pairing request in the terminal
4. Start chatting!

## Features

### DM Pairing System

**Security-first design:** Users must explicitly pair before interaction.

**Pairing Flow:**
1. User sends `/start` to bot
2. Approval prompt appears in local terminal
3. Local user approves or denies
4. On approval: User ID saved to config
5. Paired users can send messages

**Benefits:**
- No unauthorized access
- Clear audit trail
- User control over who pairs

### Commands

| Command | Description | Requires Pairing |
|---------|-------------|------------------|
| `/start` | Initiate pairing | No |
| `/help` | Show available commands | No |
| `/status` | Show bot status and uptime | Yes |

Future commands (planned):
- `/pause` - Pause heartbeat
- `/resume` - Resume heartbeat
- `/memory <query>` - Search memories

### Message Routing

**Telegram → Agent:**
```
User sends message
    ↓
TelegramBot receives
    ↓
Check if user is paired
    ↓
Call messageHandler
    ↓
Agent processes message
    ↓
Return response
```

**Agent → Telegram:**
```
Agent generates response
    ↓
HTML formatting applied
    ↓
Send via Telegram API
    ↓
User receives message
```

### HTML Formatting

Supports Telegram HTML subset:
- `<b>bold</b>` - Bold text
- `<i>italic</i>` - Italic text
- `<code>code</code>` - Inline code
- `<pre>code block</pre>` - Code block

Example:
```typescript
await bot.sendMessage(userId, '<b>Status:</b> ✅ Online');
```

## Configuration

### Config Settings

```typescript
{
  telegram: {
    enabled: boolean,           // Enable/disable integration
    botToken?: string,          // (Stored in secrets.env)
    pairedUsers: number[],      // List of paired user IDs
    enableGroups: boolean,      // Allow group chats (Phase 1: false)
    notifyHeartbeat: boolean    // Send heartbeat notifications
  }
}
```

### Secrets Storage

Bot token stored securely in `~/.mudpuppy/secrets.env`:

```env
# Mudpuppy Secrets
# DO NOT COMMIT THIS FILE TO VERSION CONTROL

TELEGRAM_BOT_TOKEN=123456789:ABC-DEFgh...
```

## Programmatic Usage

```typescript
import { TelegramBot } from 'mudpuppy/telegram';
import { ConfigManager } from 'mudpuppy';
import { SecretsManager } from 'mudpuppy/secrets';
import { ApprovalManager } from 'mudpuppy/security';

// Initialize
const config = new ConfigManager();
const secrets = new SecretsManager();
const approval = new ApprovalManager();
const bot = new TelegramBot(config, secrets);

// Set up handlers
bot.setPairingHandler(async (userId, username) => {
  return await approval.requestApproval({
    title: 'Telegram Pairing Request',
    description: `User @${username} (${userId}) wants to pair`,
  });
});

bot.setMessageHandler(async (userId, text) => {
  console.log(`Message from ${userId}: ${text}`);
  return `Received: ${text}`;
});

// Start bot
await bot.start();

// Send notification to all paired users
await bot.sendNotification('🔔 Heartbeat complete!');

// Stop bot
await bot.stop();
```

## CLI Commands

See [API.md](./API.md) for complete CLI reference.

## Security Considerations

### Pairing Security

- **Approval required**: All pairing requests require local approval
- **User ID tracking**: Paired users persisted in config
- **Revocation**: Remove user ID from config to unpair

### Message Security

- **Paired users only**: Unpaired users receive rejection message
- **No sensitive data**: Don't send secrets or API keys over Telegram
- **Audit logging**: All Telegram commands logged (Phase 5)

### Bot Token Security

- **Gitignored**: `secrets.env` never committed
- **File permissions**: Readable only by owner
- **Rotation**: Easy to set new token via CLI

## Performance

- **Startup time**: <2 seconds
- **Message latency**: <500ms (Telegram API dependent)
- **Polling**: Long-polling by default (efficient, no webhooks needed)
- **Memory usage**: ~50MB (grammY is lightweight)

## Error Handling

### Common Errors

**401 Unauthorized:**
- Invalid bot token
- Solution: Get new token from @BotFather

**403 Forbidden:**
- Bot blocked by user
- Solution: User must unblock bot

**429 Too Many Requests:**
- Rate limited by Telegram
- Solution: Automatic retry with backoff (handled by grammY)

### Graceful Degradation

- Network errors: Retry automatically
- API errors: Log and continue
- Invalid messages: Send error to user

## Limitations (Phase 1)

Current limitations (to be addressed in future phases):
- **No group chat support**: DM only
- **Simple message handling**: Echo only (Phase 2: integrate with Soul)
- **No file uploads**: Text messages only
- **No inline keyboards**: Planned for future
- **No webhook support**: Polling only

## Testing

See [TESTING.md](./TESTING.md) for testing strategy.

For manual testing steps, see [TESTING_MANUAL.md](../../TESTING_MANUAL.md).

## See Also

- [API Documentation](./API.md)
- [Implementation Details](./IMPLEMENTATION.md)
- [Testing Strategy](./TESTING.md)
- [grammY Documentation](https://grammy.dev/)
