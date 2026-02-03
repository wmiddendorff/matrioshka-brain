/**
 * Telegram IPC Protocol
 *
 * Defines the request/response format for communication between
 * MCP tools and the Telegram bot daemon over Unix socket.
 */

import type {
  TelegramMessage,
  PairingRequest,
  PairedUser,
  BotStatus,
  SendResult,
  PollOptions,
  SendOptions,
  PairOptions,
} from './types.js';

/**
 * IPC request from MCP tool to bot daemon
 */
export interface IPCRequest {
  /** Unique request ID for correlation */
  id: string;
  /** Method to invoke */
  method: IPCMethod;
  /** Method parameters */
  params?: Record<string, unknown>;
}

/**
 * Available IPC methods
 */
export type IPCMethod =
  | 'poll'      // Get pending messages
  | 'send'      // Send a message
  | 'pair'      // Manage pairings (list/approve/deny/revoke)
  | 'status'    // Get bot status
  | 'ping';     // Health check

/**
 * IPC response from bot daemon to MCP tool
 */
export interface IPCResponse {
  /** Request ID this is responding to */
  id: string;
  /** Whether the request succeeded */
  success: boolean;
  /** Error message if success is false */
  error?: string;
  /** Result data if success is true */
  result?: unknown;
}

// ============================================
// Method-specific request/response types
// ============================================

/**
 * Poll request parameters
 */
export interface PollParams extends PollOptions {}

/**
 * Poll response result
 */
export interface PollResult {
  messages: TelegramMessage[];
  total: number;
}

/**
 * Send request parameters
 */
export interface SendParams extends SendOptions {}

/**
 * Send response result
 */
export type SendResultResponse = SendResult;

/**
 * Pair request parameters
 */
export interface PairParams extends PairOptions {}

/**
 * Pair response result
 */
export interface PairResult {
  /** For 'list' action */
  pendingRequests?: PairingRequest[];
  pairedUsers?: PairedUser[];
  /** For 'approve'/'deny'/'revoke' actions */
  success?: boolean;
  message?: string;
}

/**
 * Status response result
 */
export type StatusResult = BotStatus;

/**
 * Ping response result
 */
export interface PingResult {
  pong: true;
  timestamp: number;
}

// ============================================
// Helper functions
// ============================================

/**
 * Create an IPC request
 */
export function createRequest(
  method: IPCMethod,
  params?: Record<string, unknown>
): IPCRequest {
  return {
    id: crypto.randomUUID(),
    method,
    params,
  };
}

/**
 * Create a success response
 */
export function createSuccessResponse(
  requestId: string,
  result: unknown
): IPCResponse {
  return {
    id: requestId,
    success: true,
    result,
  };
}

/**
 * Create an error response
 */
export function createErrorResponse(
  requestId: string,
  error: string
): IPCResponse {
  return {
    id: requestId,
    success: false,
    error,
  };
}

/**
 * Parse a JSON line into an IPC request
 */
export function parseRequest(line: string): IPCRequest | null {
  try {
    const parsed = JSON.parse(line);
    if (typeof parsed.id === 'string' && typeof parsed.method === 'string') {
      return parsed as IPCRequest;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse a JSON line into an IPC response
 */
export function parseResponse(line: string): IPCResponse | null {
  try {
    const parsed = JSON.parse(line);
    if (typeof parsed.id === 'string' && typeof parsed.success === 'boolean') {
      return parsed as IPCResponse;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Serialize a request/response to a JSON line
 */
export function serialize(data: IPCRequest | IPCResponse): string {
  return JSON.stringify(data) + '\n';
}
