#!/usr/bin/env node
/**
 * Telegram Bot Daemon
 *
 * Background process that:
 * 1. Connects to Telegram via grammY
 * 2. Listens for messages and queues them to SQLite
 * 3. Serves IPC requests over Unix socket
 *
 * This file is meant to be run as a daemon process via daemon.ts
 */

import { Bot, Context } from 'grammy';
import { createServer, Socket } from 'net';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { dirname } from 'path';
import { resolvePath } from '../config.js';
import { getSecret } from '../secrets.js';
import { getSocketPath, writePid, removePid, isWindows } from './daemon.js';
import {
  IPCRequest,
  IPCResponse,
  parseRequest,
  createSuccessResponse,
  createErrorResponse,
  serialize,
} from './protocol.js';
import type {
  TelegramMessage,
  PairingRequest,
  PairedUser,
  BotStatus,
  SendResult,
} from './types.js';
import type { PollResult, PairResult } from './protocol.js';

// ============================================
// Database Setup
// ============================================

const DB_PATH = 'data/telegram.db';

function getDb(): Database.Database {
  const dbPath = resolvePath(DB_PATH);
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);

  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    -- Paired users
    CREATE TABLE IF NOT EXISTS telegram_users (
      id INTEGER PRIMARY KEY,  -- Telegram user ID
      username TEXT,
      first_name TEXT,
      paired_at INTEGER NOT NULL,
      message_count INTEGER DEFAULT 0
    );

    -- Message queue
    CREATE TABLE IF NOT EXISTS telegram_messages (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      telegram_message_id INTEGER NOT NULL,
      chat_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      read INTEGER DEFAULT 0
    );

    -- Pending pairing requests
    CREATE TABLE IF NOT EXISTS pending_approvals (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      username TEXT,
      first_name TEXT,
      created_at INTEGER NOT NULL,
      status TEXT DEFAULT 'pending'
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_messages_user ON telegram_messages(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_read ON telegram_messages(read);
    CREATE INDEX IF NOT EXISTS idx_approvals_status ON pending_approvals(status);
  `);

  return db;
}

// ============================================
// Bot State
// ============================================

interface DaemonState {
  db: Database.Database;
  bot: Bot;
  botInfo: { username: string; first_name: string } | null;
  startedAt: number;
  lastError: string | null;
}

let state: DaemonState | null = null;

// ============================================
// Database Operations
// ============================================

function isPaired(db: Database.Database, userId: number): boolean {
  const row = db.prepare('SELECT id FROM telegram_users WHERE id = ?').get(userId);
  return row !== undefined;
}

function getPairedUser(db: Database.Database, userId: number): PairedUser | null {
  const row = db.prepare(`
    SELECT id, username, first_name, paired_at, message_count
    FROM telegram_users WHERE id = ?
  `).get(userId) as { id: number; username: string | null; first_name: string | null; paired_at: number; message_count: number } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    username: row.username ?? undefined,
    firstName: row.first_name ?? undefined,
    pairedAt: row.paired_at,
    messageCount: row.message_count,
  };
}

function getAllPairedUsers(db: Database.Database): PairedUser[] {
  const rows = db.prepare(`
    SELECT id, username, first_name, paired_at, message_count
    FROM telegram_users ORDER BY paired_at DESC
  `).all() as { id: number; username: string | null; first_name: string | null; paired_at: number; message_count: number }[];

  return rows.map((row) => ({
    id: row.id,
    username: row.username ?? undefined,
    firstName: row.first_name ?? undefined,
    pairedAt: row.paired_at,
    messageCount: row.message_count,
  }));
}

function addPairedUser(db: Database.Database, userId: number, username?: string, firstName?: string): void {
  db.prepare(`
    INSERT OR REPLACE INTO telegram_users (id, username, first_name, paired_at, message_count)
    VALUES (?, ?, ?, ?, COALESCE((SELECT message_count FROM telegram_users WHERE id = ?), 0))
  `).run(userId, username ?? null, firstName ?? null, Date.now(), userId);
}

function removePairedUser(db: Database.Database, userId: number): boolean {
  const result = db.prepare('DELETE FROM telegram_users WHERE id = ?').run(userId);
  return result.changes > 0;
}

function hasPendingRequest(db: Database.Database, userId: number): boolean {
  const row = db.prepare(`
    SELECT id FROM pending_approvals WHERE user_id = ? AND status = 'pending'
  `).get(userId);
  return row !== undefined;
}

function createPairingRequest(db: Database.Database, userId: number, username?: string, firstName?: string): string {
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO pending_approvals (id, user_id, username, first_name, created_at, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(id, userId, username ?? null, firstName ?? null, Date.now());
  return id;
}

function getPendingRequests(db: Database.Database): PairingRequest[] {
  const rows = db.prepare(`
    SELECT id, user_id, username, first_name, created_at, status
    FROM pending_approvals WHERE status = 'pending' ORDER BY created_at DESC
  `).all() as { id: string; user_id: number; username: string | null; first_name: string | null; created_at: number; status: string }[];

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    username: row.username ?? undefined,
    firstName: row.first_name ?? undefined,
    createdAt: row.created_at,
    status: row.status as 'pending' | 'approved' | 'denied',
  }));
}

function updateRequestStatus(db: Database.Database, requestIdOrUserId: string | number, status: 'approved' | 'denied'): boolean {
  let result;
  if (typeof requestIdOrUserId === 'string') {
    result = db.prepare(`
      UPDATE pending_approvals SET status = ? WHERE id = ? AND status = 'pending'
    `).run(status, requestIdOrUserId);
  } else {
    result = db.prepare(`
      UPDATE pending_approvals SET status = ? WHERE user_id = ? AND status = 'pending'
    `).run(status, requestIdOrUserId);
  }
  return result.changes > 0;
}

function getRequestByIdOrUserId(db: Database.Database, requestIdOrUserId: string | number): PairingRequest | null {
  let row;
  if (typeof requestIdOrUserId === 'string') {
    row = db.prepare(`
      SELECT id, user_id, username, first_name, created_at, status
      FROM pending_approvals WHERE id = ?
    `).get(requestIdOrUserId);
  } else {
    row = db.prepare(`
      SELECT id, user_id, username, first_name, created_at, status
      FROM pending_approvals WHERE user_id = ? AND status = 'pending'
    `).get(requestIdOrUserId);
  }

  if (!row) return null;
  const r = row as { id: string; user_id: number; username: string | null; first_name: string | null; created_at: number; status: string };

  return {
    id: r.id,
    userId: r.user_id,
    username: r.username ?? undefined,
    firstName: r.first_name ?? undefined,
    createdAt: r.created_at,
    status: r.status as 'pending' | 'approved' | 'denied',
  };
}

function queueMessage(db: Database.Database, msg: TelegramMessage): void {
  db.prepare(`
    INSERT INTO telegram_messages (id, user_id, telegram_message_id, chat_id, text, timestamp, read)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(msg.id, msg.userId, msg.telegramMessageId, msg.chatId, msg.text, msg.timestamp);

  // Increment message count for user
  db.prepare(`
    UPDATE telegram_users SET message_count = message_count + 1 WHERE id = ?
  `).run(msg.userId);
}

function getMessages(
  db: Database.Database,
  options: { unreadOnly?: boolean; limit?: number; userId?: number; markAsRead?: boolean }
): TelegramMessage[] {
  let query = 'SELECT * FROM telegram_messages WHERE 1=1';
  const params: unknown[] = [];

  if (options.unreadOnly !== false) {
    query += ' AND read = 0';
  }

  if (options.userId !== undefined) {
    query += ' AND user_id = ?';
    params.push(options.userId);
  }

  query += ' ORDER BY timestamp ASC';

  if (options.limit !== undefined) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }

  const rows = db.prepare(query).all(...params) as {
    id: string;
    user_id: number;
    telegram_message_id: number;
    chat_id: number;
    text: string;
    timestamp: number;
    read: number;
  }[];

  const messages: TelegramMessage[] = rows.map((row) => {
    // Get user info for each message
    const user = getPairedUser(db, row.user_id);
    return {
      id: row.id,
      userId: row.user_id,
      username: user?.username,
      firstName: user?.firstName,
      text: row.text,
      timestamp: row.timestamp,
      read: row.read === 1,
      telegramMessageId: row.telegram_message_id,
      chatId: row.chat_id,
    };
  });

  // Mark as read if requested
  if (options.markAsRead !== false && messages.length > 0) {
    const ids = messages.map((m) => m.id);
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`UPDATE telegram_messages SET read = 1 WHERE id IN (${placeholders})`).run(...ids);
  }

  return messages;
}

function getStats(db: Database.Database): { pairedUsers: number; pendingRequests: number; unreadMessages: number } {
  const pairedUsers = (db.prepare('SELECT COUNT(*) as count FROM telegram_users').get() as { count: number }).count;
  const pendingRequests = (db.prepare("SELECT COUNT(*) as count FROM pending_approvals WHERE status = 'pending'").get() as { count: number }).count;
  const unreadMessages = (db.prepare('SELECT COUNT(*) as count FROM telegram_messages WHERE read = 0').get() as { count: number }).count;

  return { pairedUsers, pendingRequests, unreadMessages };
}

// ============================================
// IPC Handler
// ============================================

async function handleIPC(request: IPCRequest): Promise<IPCResponse> {
  if (!state) {
    return createErrorResponse(request.id, 'Daemon not initialized');
  }

  const { db, bot, botInfo } = state;

  try {
    switch (request.method) {
      case 'ping': {
        return createSuccessResponse(request.id, { pong: true, timestamp: Date.now() });
      }

      case 'status': {
        const stats = getStats(db);
        const status: BotStatus = {
          running: true,
          botUsername: botInfo?.username,
          botName: botInfo?.first_name,
          startedAt: state.startedAt,
          pid: process.pid,
          pairedUsers: stats.pairedUsers,
          pendingRequests: stats.pendingRequests,
          unreadMessages: stats.unreadMessages,
          lastError: state.lastError ?? undefined,
        };
        return createSuccessResponse(request.id, status);
      }

      case 'poll': {
        const params = request.params ?? {};
        const messages = getMessages(db, {
          unreadOnly: params.unreadOnly as boolean | undefined,
          limit: params.limit as number | undefined,
          userId: params.userId as number | undefined,
          markAsRead: params.markAsRead as boolean | undefined,
        });
        const result: PollResult = {
          messages,
          total: messages.length,
        };
        return createSuccessResponse(request.id, result);
      }

      case 'send': {
        const params = request.params as { userId: number; text: string; parseMode?: string; disableLinkPreview?: boolean; replyToMessageId?: number };
        if (!params.userId || !params.text) {
          return createErrorResponse(request.id, 'Missing userId or text');
        }

        // Check if user is paired
        if (!isPaired(db, params.userId)) {
          return createErrorResponse(request.id, 'User is not paired');
        }

        try {
          const sentMsg = await bot.api.sendMessage(params.userId, params.text, {
            parse_mode: (params.parseMode as 'HTML' | 'Markdown' | 'MarkdownV2') ?? 'HTML',
            link_preview_options: params.disableLinkPreview ? { is_disabled: true } : undefined,
            reply_parameters: params.replyToMessageId ? { message_id: params.replyToMessageId } : undefined,
          });
          const result: SendResult = {
            success: true,
            messageId: sentMsg.message_id,
          };
          return createSuccessResponse(request.id, result);
        } catch (error) {
          const result: SendResult = {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
          return createSuccessResponse(request.id, result);
        }
      }

      case 'pair': {
        const params = request.params as { action: string; userId?: number; requestId?: string };
        const action = params.action;

        switch (action) {
          case 'list': {
            const result: PairResult = {
              pendingRequests: getPendingRequests(db),
              pairedUsers: getAllPairedUsers(db),
            };
            return createSuccessResponse(request.id, result);
          }

          case 'approve': {
            const id = params.requestId ?? params.userId;
            if (!id) {
              return createErrorResponse(request.id, 'Missing userId or requestId');
            }

            const req = getRequestByIdOrUserId(db, id);
            if (!req) {
              return createErrorResponse(request.id, 'Pairing request not found');
            }

            if (req.status !== 'pending') {
              return createErrorResponse(request.id, `Request already ${req.status}`);
            }

            // Approve the request
            updateRequestStatus(db, id, 'approved');
            addPairedUser(db, req.userId, req.username, req.firstName);

            // Notify user via Telegram
            try {
              await bot.api.sendMessage(req.userId, '✅ Your pairing request has been approved! You can now send messages.');
            } catch {
              // Ignore notification errors
            }

            const result: PairResult = {
              success: true,
              message: `Approved pairing for user ${req.userId} (${req.username ?? req.firstName ?? 'unknown'})`,
            };
            return createSuccessResponse(request.id, result);
          }

          case 'deny': {
            const id = params.requestId ?? params.userId;
            if (!id) {
              return createErrorResponse(request.id, 'Missing userId or requestId');
            }

            const req = getRequestByIdOrUserId(db, id);
            if (!req) {
              return createErrorResponse(request.id, 'Pairing request not found');
            }

            if (req.status !== 'pending') {
              return createErrorResponse(request.id, `Request already ${req.status}`);
            }

            updateRequestStatus(db, id, 'denied');

            // Notify user via Telegram
            try {
              await bot.api.sendMessage(req.userId, '❌ Your pairing request was denied.');
            } catch {
              // Ignore notification errors
            }

            const result: PairResult = {
              success: true,
              message: `Denied pairing for user ${req.userId}`,
            };
            return createSuccessResponse(request.id, result);
          }

          case 'revoke': {
            const userId = params.userId;
            if (!userId) {
              return createErrorResponse(request.id, 'Missing userId');
            }

            const removed = removePairedUser(db, userId);
            if (!removed) {
              return createErrorResponse(request.id, 'User not found in paired users');
            }

            // Notify user via Telegram
            try {
              await bot.api.sendMessage(userId, '🔒 Your pairing has been revoked.');
            } catch {
              // Ignore notification errors
            }

            const result: PairResult = {
              success: true,
              message: `Revoked pairing for user ${userId}`,
            };
            return createSuccessResponse(request.id, result);
          }

          default:
            return createErrorResponse(request.id, `Unknown pair action: ${action}`);
        }
      }

      default:
        return createErrorResponse(request.id, `Unknown method: ${request.method}`);
    }
  } catch (error) {
    return createErrorResponse(request.id, error instanceof Error ? error.message : String(error));
  }
}

// ============================================
// Socket Server
// ============================================

function startSocketServer(): void {
  const socketPath = getSocketPath();

  // Clean up old socket file if it exists (Unix only - named pipes don't exist in filesystem)
  if (!isWindows() && existsSync(socketPath)) {
    unlinkSync(socketPath);
  }

  // Ensure directory exists (Unix only)
  if (!isWindows()) {
    const dir = dirname(socketPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  const server = createServer((socket: Socket) => {
    let buffer = '';

    socket.on('data', async (data) => {
      buffer += data.toString();

      // Process complete lines (newline-delimited JSON)
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        const request = parseRequest(line);
        if (!request) {
          socket.write(serialize(createErrorResponse('unknown', 'Invalid request format')));
          continue;
        }

        const response = await handleIPC(request);
        socket.write(serialize(response));
      }
    });

    socket.on('error', (err) => {
      console.error('Socket error:', err);
    });
  });

  server.listen(socketPath, () => {
    console.log(`Socket server listening on ${socketPath}`);
  });

  server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
  });

  // Cleanup on exit
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down...');
    server.close();
    if (!isWindows() && existsSync(socketPath)) {
      unlinkSync(socketPath);
    }
    removePid();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down...');
    server.close();
    if (!isWindows() && existsSync(socketPath)) {
      unlinkSync(socketPath);
    }
    removePid();
    process.exit(0);
  });
}

// ============================================
// Bot Setup
// ============================================

async function startBot(): Promise<void> {
  const token = getSecret('TELEGRAM_BOT_TOKEN');
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN not set in secrets.env');
    process.exit(1);
  }

  const db = getDb();
  const bot = new Bot(token);

  // Get bot info
  const me = await bot.api.getMe();
  console.log(`Bot authenticated as @${me.username}`);

  state = {
    db,
    bot,
    botInfo: { username: me.username!, first_name: me.first_name },
    startedAt: Date.now(),
    lastError: null,
  };

  // /start command - initiate pairing
  bot.command('start', async (ctx: Context) => {
    const userId = ctx.from?.id;
    const username = ctx.from?.username;
    const firstName = ctx.from?.first_name;

    if (!userId) return;

    // Check if already paired
    if (isPaired(db, userId)) {
      await ctx.reply('✅ You are already paired! Send me a message anytime.');
      return;
    }

    // Check if already has pending request
    if (hasPendingRequest(db, userId)) {
      await ctx.reply('⏳ You already have a pending pairing request. Please wait for approval.');
      return;
    }

    // Create pairing request
    createPairingRequest(db, userId, username, firstName);
    await ctx.reply(
      '🧠 Welcome to Matrioshka Brain!\n\n' +
        'A pairing request has been created. ' +
        'The owner will need to approve it before you can send messages.\n\n' +
        'You will be notified when your request is processed.'
    );
  });

  // /help command
  bot.command('help', async (ctx: Context) => {
    await ctx.reply(
      '🧠 <b>Matrioshka Brain Bot</b>\n\n' +
        '<b>Commands:</b>\n' +
        '/start - Request pairing\n' +
        '/help - Show this message\n' +
        '/status - Check your pairing status\n\n' +
        '<b>How it works:</b>\n' +
        '1. Use /start to request pairing\n' +
        '2. Wait for owner approval\n' +
        '3. Send messages directly',
      { parse_mode: 'HTML' }
    );
  });

  // /status command
  bot.command('status', async (ctx: Context) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    if (isPaired(db, userId)) {
      const user = getPairedUser(db, userId);
      await ctx.reply(
        `✅ <b>Paired</b>\n\n` +
          `Messages sent: ${user?.messageCount ?? 0}\n` +
          `Paired since: ${new Date(user?.pairedAt ?? 0).toLocaleDateString()}`,
        { parse_mode: 'HTML' }
      );
    } else if (hasPendingRequest(db, userId)) {
      await ctx.reply('⏳ Your pairing request is pending approval.');
    } else {
      await ctx.reply('❌ Not paired. Use /start to request pairing.');
    }
  });

  // Handle all text messages
  bot.on('message:text', async (ctx: Context) => {
    const userId = ctx.from?.id;
    const text = ctx.message?.text;
    const messageId = ctx.message?.message_id;
    const chatId = ctx.chat?.id;

    if (!userId || !text || !messageId || !chatId) return;

    // Only accept messages from paired users
    if (!isPaired(db, userId)) {
      await ctx.reply('⚠️ You need to be paired first. Use /start to request pairing.');
      return;
    }

    // Queue the message
    const msg: TelegramMessage = {
      id: crypto.randomUUID(),
      userId,
      username: ctx.from?.username,
      firstName: ctx.from?.first_name,
      text,
      timestamp: Date.now(),
      read: false,
      telegramMessageId: messageId,
      chatId,
    };

    queueMessage(db, msg);

    // Acknowledge receipt (optional - could be removed for cleaner UX)
    // await ctx.reply('📨 Message received');
  });

  // Error handling
  bot.catch((err) => {
    console.error('Bot error:', err);
    if (state) {
      state.lastError = err.message;
    }
  });

  // Start socket server before bot polling
  startSocketServer();

  // Signal that daemon is ready
  console.log('DAEMON_READY');

  // Write PID file
  writePid(process.pid);

  // Start polling
  await bot.start({
    onStart: () => {
      console.log(`Bot started polling`);
    },
  });
}

// ============================================
// Main
// ============================================

// Only run if this is the main module and we're running as daemon
if (process.env.MATRIOSHKA_BRAIN_DAEMON === '1') {
  startBot().catch((error) => {
    console.error('Failed to start bot:', error);
    process.exit(1);
  });
}

export { startBot };
