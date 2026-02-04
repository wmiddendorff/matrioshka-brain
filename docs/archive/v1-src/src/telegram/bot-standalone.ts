#!/usr/bin/env node
/**
 * MatrioshkaBrain Telegram Bot - Standalone Process
 *
 * Runs independently and communicates via file queues:
 * - Writes incoming messages to ~/.matrioshka-brain/telegram-queue.jsonl
 * - Reads outgoing responses from ~/.matrioshka-brain/telegram-responses.jsonl
 * - Handles pairing, commands, and message routing
 */

import { Bot } from 'grammy';
import { ConfigManager } from '../config.js';
import { SecretsManager } from '../secrets.js';
import { appendFileSync, readFileSync, writeFileSync, existsSync, mkdirSync, watchFile } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const config = new ConfigManager();
const secrets = new SecretsManager();

const QUEUE_DIR = join(homedir(), '.matrioshka-brain');
const INCOMING_QUEUE = join(QUEUE_DIR, 'telegram-queue.jsonl');
const OUTGOING_QUEUE = join(QUEUE_DIR, 'telegram-responses.jsonl');
const PAIRING_QUEUE = join(QUEUE_DIR, 'telegram-pairing-requests.jsonl');

// Ensure queue directory exists
if (!existsSync(QUEUE_DIR)) {
  mkdirSync(QUEUE_DIR, { recursive: true });
}

const token = secrets.get('TELEGRAM_BOT_TOKEN');
if (!token) {
  console.error('❌ No Telegram bot token found');
  console.error('Run: node dist/cli/index.js telegram set-token <TOKEN>');
  process.exit(1);
}

const bot = new Bot(token);

// Track processed messages
const processedResponses = new Set<string>();

console.log('🤖 Starting MatrioshkaBrain Telegram Bot (Standalone)...');

// Handle /start command - pairing
bot.command('start', async (ctx) => {
  const userId = ctx.from?.id;
  const username = ctx.from?.username;

  if (!userId) {
    await ctx.reply('❌ Could not identify user');
    return;
  }

  // Check if already paired
  const pairedUsers = config.get().telegram.pairedUsers;
  if (pairedUsers.includes(userId)) {
    await ctx.reply('✅ You are already paired with MatrioshkaBrain!');
    return;
  }

  // Write pairing request to queue
  const pairingRequest = {
    userId,
    username: username || 'unknown',
    timestamp: Date.now(),
  };

  appendFileSync(PAIRING_QUEUE, JSON.stringify(pairingRequest) + '\n');

  await ctx.reply('⏳ Pairing request sent. Check your Claude Code terminal for approval.');
});

// Handle /status command
bot.command('status', async (ctx) => {
  const userId = ctx.from?.id;

  if (!userId || !config.get().telegram.pairedUsers.includes(userId)) {
    await ctx.reply('❌ You are not paired. Send /start to begin pairing.');
    return;
  }

  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);

  await ctx.reply(
    `🤖 <b>MatrioshkaBrain Status</b>\n\n` +
    `✅ Bot Online\n` +
    `⏱ Uptime: ${hours}h ${minutes}m\n` +
    `👥 Paired users: ${config.get().telegram.pairedUsers.length}`,
    { parse_mode: 'HTML' }
  );
});

// Handle /help command
bot.command('help', async (ctx) => {
  await ctx.reply(
    `<b>MatrioshkaBrain Commands:</b>\n\n` +
    `/start - Pair with MatrioshkaBrain\n` +
    `/status - Check bot status\n` +
    `/help - Show this help\n\n` +
    `Send any message to chat with Claude!`,
    { parse_mode: 'HTML' }
  );
});

// Handle regular messages - write to queue
bot.on('message:text', async (ctx) => {
  const userId = ctx.from?.id;
  const text = ctx.message.text;

  if (!userId || !text) return;

  // Skip if it's a command
  if (text.startsWith('/')) return;

  // Check if paired
  if (!config.get().telegram.pairedUsers.includes(userId)) {
    await ctx.reply('❌ You are not paired. Send /start to begin pairing.');
    return;
  }

  // Write message to incoming queue for Claude Code to process
  const message = {
    userId,
    username: ctx.from.username || 'unknown',
    text,
    timestamp: Date.now(),
    messageId: ctx.message.message_id,
  };

  appendFileSync(INCOMING_QUEUE, JSON.stringify(message) + '\n');
  console.log(`📨 Queued message from ${userId}: ${text}`);

  // Send acknowledgment
  await ctx.reply('⏳ Processing...', { reply_to_message_id: ctx.message.message_id });
});

// Watch for outgoing responses and send them
function watchOutgoingQueue() {
  if (!existsSync(OUTGOING_QUEUE)) {
    writeFileSync(OUTGOING_QUEUE, '');
  }

  watchFile(OUTGOING_QUEUE, { interval: 1000 }, async () => {
    try {
      const content = readFileSync(OUTGOING_QUEUE, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line);

      for (const line of lines) {
        try {
          const response = JSON.parse(line);
          const responseId = `${response.userId}-${response.timestamp}`;

          if (processedResponses.has(responseId)) {
            continue; // Already sent
          }

          // Send response via Telegram
          await bot.api.sendMessage(response.userId, response.text, {
            parse_mode: 'HTML',
          });

          console.log(`✅ Sent response to ${response.userId}`);
          processedResponses.add(responseId);

        } catch (err) {
          console.error('Error processing response:', err);
        }
      }

      // Clear processed responses after sending
      if (lines.length > 0) {
        const unprocessed = lines.filter(line => {
          const response = JSON.parse(line);
          const responseId = `${response.userId}-${response.timestamp}`;
          return !processedResponses.has(responseId);
        });

        if (unprocessed.length === 0) {
          writeFileSync(OUTGOING_QUEUE, '');
          processedResponses.clear();
        }
      }
    } catch (err) {
      console.error('Error watching outgoing queue:', err);
    }
  });

  console.log('👁️  Watching for outgoing responses...');
}

// Start bot
bot.start({
  onStart: (botInfo) => {
    console.log(`✅ MatrioshkaBrain bot started: @${botInfo.username}`);
    console.log(`📝 Incoming queue: ${INCOMING_QUEUE}`);
    console.log(`📤 Outgoing queue: ${OUTGOING_QUEUE}`);
    watchOutgoingQueue();
  },
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down MatrioshkaBrain bot...');
  await bot.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await bot.stop();
  process.exit(0);
});
