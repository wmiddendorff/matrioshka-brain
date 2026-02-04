# Telegram Integration - API Reference

## MCP Tools

### `telegram_status`

Get the status of the Telegram bot daemon.

**Input:**
```json
{}
```

**Output (daemon running):**
```json
{
  "running": true,
  "reachable": true,
  "botUsername": "matrioshka-brain_bot",
  "botName": "Matrioshka Brain",
  "startedAt": 1706900000000,
  "pid": 12345,
  "pairedUsers": 2,
  "pendingRequests": 1,
  "unreadMessages": 5,
  "lastError": null
}
```

**Output (daemon not running):**
```json
{
  "running": false,
  "reachable": false,
  "error": "Daemon not running",
  "hint": "Start the daemon with: matrioshka-brain telegram start"
}
```

### `telegram_poll`

Poll for pending messages from paired users.

**Input:**
```json
{
  "unreadOnly": true,
  "limit": 10,
  "userId": 12345,
  "markAsRead": true
}
```

All parameters are optional. Defaults: `unreadOnly: true`, `markAsRead: true`.

**Output:**
```json
{
  "messages": [
    {
      "id": "uuid-string",
      "userId": 12345,
      "username": "testuser",
      "firstName": "Test",
      "text": "Hello!",
      "timestamp": 1706900000000,
      "read": false,
      "telegramMessageId": 456,
      "chatId": 12345
    }
  ],
  "total": 1
}
```

**Output (daemon not running):**
```json
{
  "error": "Telegram bot daemon is not running",
  "hint": "Start the daemon with: matrioshka-brain telegram start",
  "messages": [],
  "total": 0
}
```

### `telegram_send`

Send a message to a paired Telegram user. Supports HTML formatting.

**Input:**
```json
{
  "userId": 12345,
  "text": "<b>Hello</b> from Matrioshka Brain!",
  "parseMode": "HTML",
  "disableLinkPreview": false,
  "replyToMessageId": 789
}
```

Required: `userId`, `text`. Optional: `parseMode` (default: `"HTML"`), `disableLinkPreview`, `replyToMessageId`.

Maximum text length: 4096 characters.

**Output (success):**
```json
{
  "success": true,
  "messageId": 790
}
```

**Output (error):**
```json
{
  "success": false,
  "error": "User is not paired"
}
```

### `telegram_pair`

Manage Telegram user pairings.

**Input (list):**
```json
{
  "action": "list"
}
```

**Output (list):**
```json
{
  "pendingRequests": [
    {
      "id": "uuid-string",
      "userId": 12345,
      "username": "newuser",
      "firstName": "New",
      "createdAt": 1706900000000,
      "status": "pending"
    }
  ],
  "pairedUsers": [
    {
      "id": 67890,
      "username": "existinguser",
      "firstName": "Existing",
      "pairedAt": 1706800000000,
      "messageCount": 42
    }
  ]
}
```

**Input (approve):**
```json
{
  "action": "approve",
  "userId": 12345
}
```

Or by request ID:
```json
{
  "action": "approve",
  "requestId": "uuid-string"
}
```

**Output (approve/deny/revoke):**
```json
{
  "success": true,
  "message": "Approved pairing for user 12345 (newuser)"
}
```

**Actions:**
- `list` — Show pending requests and paired users
- `approve` — Approve a pending request (requires `userId` or `requestId`)
- `deny` — Deny a pending request (requires `userId` or `requestId`)
- `revoke` — Remove a paired user (requires `userId`)

When approving or denying, the user is notified via Telegram.

## IPC Protocol

Communication between MCP tools and the bot daemon uses newline-delimited JSON over a Unix socket at `~/.matrioshka-brain/bot/telegram.sock`.

### Request Format

```typescript
interface IPCRequest {
  id: string;                    // UUID for correlation
  method: IPCMethod;             // 'poll' | 'send' | 'pair' | 'status' | 'ping'
  params?: Record<string, unknown>;
}
```

### Response Format

```typescript
interface IPCResponse {
  id: string;       // Matches request ID
  success: boolean;
  error?: string;   // Present when success is false
  result?: unknown;  // Present when success is true
}
```

### Protocol Helpers

```typescript
import {
  createRequest,
  createSuccessResponse,
  createErrorResponse,
  parseRequest,
  parseResponse,
  serialize,
} from 'matrioshka-brain/telegram/protocol';

// Create a request
const req = createRequest('status');
// → { id: "uuid", method: "status" }

// Serialize to wire format (JSON + newline)
const wire = serialize(req);
// → '{"id":"uuid","method":"status"}\n'

// Parse incoming data
const parsed = parseRequest(line);
const response = parseResponse(line);
```

## Programmatic API (IPC Client)

```typescript
import {
  ping,
  getStatus,
  pollMessages,
  sendMessage,
  managePairings,
  checkConnection,
} from 'matrioshka-brain/telegram/ipc';
```

### `ping(): Promise<boolean>`

Check if the daemon is reachable. Returns `true` if the daemon responds within 2 seconds.

### `getStatus(): Promise<BotStatus>`

Get full bot status including user counts and uptime.

### `pollMessages(options?: PollOptions): Promise<PollResult>`

Retrieve messages from the queue.

```typescript
const result = await pollMessages({ unreadOnly: true, limit: 5 });
// { messages: [...], total: 3 }
```

### `sendMessage(options: SendOptions): Promise<SendResult>`

Send a message to a paired user.

```typescript
const result = await sendMessage({ userId: 12345, text: "Hello!" });
// { success: true, messageId: 790 }
```

### `managePairings(options: PairOptions): Promise<PairResult>`

Manage user pairings.

```typescript
const result = await managePairings({ action: 'list' });
// { pendingRequests: [...], pairedUsers: [...] }
```

### `checkConnection(): Promise<ConnectionStatus>`

Full connectivity check returning socket, daemon, and reachability status.

```typescript
const conn = await checkConnection();
// { socketExists: true, daemonRunning: true, reachable: true, status: {...} }
```

## Daemon Management API

```typescript
import {
  startDaemon,
  stopDaemon,
  restartDaemon,
  isDaemonRunning,
  getDaemonInfo,
} from 'matrioshka-brain/telegram/daemon';
```

### `startDaemon(): Promise<number>`

Start the bot daemon as a detached process. Returns the PID. Throws if already running or if startup fails within 10 seconds.

### `stopDaemon(): boolean`

Stop the daemon via SIGTERM (with SIGKILL fallback). Returns `true` if stopped, `false` if not running.

### `restartDaemon(): Promise<number>`

Stop then start. Returns new PID.

### `isDaemonRunning(): boolean`

Check PID file and verify process exists. Cleans up stale PID files.

### `getDaemonInfo(): { running: boolean; pid?: number }`

Get running status and PID.

## Types

```typescript
interface TelegramMessage {
  id: string;               // UUID generated by Matrioshka Brain
  userId: number;           // Telegram user ID
  username?: string;
  firstName?: string;
  text: string;
  timestamp: number;        // Unix ms
  read: boolean;
  telegramMessageId: number; // Original Telegram message ID
  chatId: number;
}

interface PairingRequest {
  id: string;
  userId: number;
  username?: string;
  firstName?: string;
  createdAt: number;
  status: 'pending' | 'approved' | 'denied';
}

interface PairedUser {
  id: number;
  username?: string;
  firstName?: string;
  pairedAt: number;
  messageCount: number;
}

interface BotStatus {
  running: boolean;
  botUsername?: string;
  botName?: string;
  startedAt?: number;
  pid?: number;
  pairedUsers: number;
  pendingRequests: number;
  unreadMessages: number;
  lastError?: string;
}

interface SendResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

interface PollOptions {
  unreadOnly?: boolean;
  limit?: number;
  userId?: number;
  markAsRead?: boolean;
}

interface SendOptions {
  userId: number;
  text: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disableLinkPreview?: boolean;
  replyToMessageId?: number;
}

interface PairOptions {
  action: 'list' | 'approve' | 'deny' | 'revoke';
  userId?: number;
  requestId?: string;
}

type IPCMethod = 'poll' | 'send' | 'pair' | 'status' | 'ping';
```
