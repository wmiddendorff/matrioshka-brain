/**
 * Telegram MCP Tools
 *
 * MCP tools for Telegram integration:
 * - telegram_poll: Get pending messages
 * - telegram_send: Send a message
 * - telegram_pair: Manage pairings
 * - telegram_status: Get bot status
 */

import { z } from 'zod';
import { registerTool } from './index.js';
import {
  checkConnection,
  getStatus,
  pollMessages,
  sendMessage,
  managePairings,
  isDaemonRunning,
} from '../telegram/index.js';

// ============================================
// telegram_status - Get bot status
// ============================================

registerTool({
  name: 'telegram_status',
  description: 'Get the status of the Telegram bot daemon. Returns connection state, bot info, and queue statistics.',
  inputSchema: z.object({}),
  handler: async () => {
    const connection = await checkConnection();

    if (!connection.reachable) {
      return {
        running: connection.daemonRunning,
        reachable: false,
        error: connection.error,
        hint: !connection.daemonRunning
          ? 'Start the daemon with: matrioshka-brain telegram start'
          : 'Daemon is running but not responding. Try: matrioshka-brain telegram restart',
      };
    }

    return {
      running: true,
      reachable: true,
      ...connection.status,
    };
  },
});

// ============================================
// telegram_poll - Get pending messages
// ============================================

registerTool({
  name: 'telegram_poll',
  description:
    'Poll for pending Telegram messages. Returns unread messages from paired users. ' +
    'Messages are marked as read after polling by default.',
  inputSchema: z.object({
    unreadOnly: z
      .boolean()
      .optional()
      .default(true)
      .describe('Only return unread messages (default: true)'),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Maximum number of messages to return'),
    userId: z
      .number()
      .int()
      .optional()
      .describe('Filter messages by user ID'),
    markAsRead: z
      .boolean()
      .optional()
      .default(true)
      .describe('Mark returned messages as read (default: true)'),
  }),
  handler: async (input) => {
    const params = input as {
      unreadOnly?: boolean;
      limit?: number;
      userId?: number;
      markAsRead?: boolean;
    };

    // Check daemon status first
    if (!isDaemonRunning()) {
      return {
        error: 'Telegram bot daemon is not running',
        hint: 'Start the daemon with: matrioshka-brain telegram start',
        messages: [],
        total: 0,
      };
    }

    try {
      const result = await pollMessages(params);
      return result;
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        messages: [],
        total: 0,
      };
    }
  },
});

// ============================================
// telegram_send - Send a message
// ============================================

registerTool({
  name: 'telegram_send',
  description:
    'Send a message to a paired Telegram user. Supports HTML formatting. ' +
    'The user must be paired before you can send messages to them.',
  inputSchema: z.object({
    userId: z
      .number()
      .int()
      .describe('Telegram user ID to send the message to'),
    text: z
      .string()
      .min(1)
      .max(4096)
      .describe('Message text to send (max 4096 characters)'),
    parseMode: z
      .enum(['HTML', 'Markdown', 'MarkdownV2'])
      .optional()
      .default('HTML')
      .describe('Message parse mode (default: HTML)'),
    disableLinkPreview: z
      .boolean()
      .optional()
      .describe('Disable link preview in the message'),
    replyToMessageId: z
      .number()
      .int()
      .optional()
      .describe('Message ID to reply to (optional)'),
  }),
  handler: async (input) => {
    const params = input as {
      userId: number;
      text: string;
      parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
      disableLinkPreview?: boolean;
      replyToMessageId?: number;
    };

    // Check daemon status first
    if (!isDaemonRunning()) {
      return {
        success: false,
        error: 'Telegram bot daemon is not running',
        hint: 'Start the daemon with: matrioshka-brain telegram start',
      };
    }

    try {
      const result = await sendMessage(params);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

// ============================================
// telegram_pair - Manage pairings
// ============================================

registerTool({
  name: 'telegram_pair',
  description:
    'Manage Telegram user pairings. ' +
    'Actions: "list" shows pending requests and paired users, ' +
    '"approve" approves a pending request, ' +
    '"deny" denies a pending request, ' +
    '"revoke" removes a paired user.',
  inputSchema: z.object({
    action: z
      .enum(['list', 'approve', 'deny', 'revoke'])
      .describe('Action to perform'),
    userId: z
      .number()
      .int()
      .optional()
      .describe('User ID for approve/deny/revoke actions'),
    requestId: z
      .string()
      .optional()
      .describe('Request ID for approve/deny (alternative to userId)'),
  }),
  handler: async (input) => {
    const params = input as {
      action: 'list' | 'approve' | 'deny' | 'revoke';
      userId?: number;
      requestId?: string;
    };

    // Check daemon status first
    if (!isDaemonRunning()) {
      return {
        success: false,
        error: 'Telegram bot daemon is not running',
        hint: 'Start the daemon with: matrioshka-brain telegram start',
      };
    }

    // Validate parameters for non-list actions
    if (params.action !== 'list' && !params.userId && !params.requestId) {
      return {
        success: false,
        error: `Missing userId or requestId for action: ${params.action}`,
      };
    }

    try {
      const result = await managePairings(params);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
