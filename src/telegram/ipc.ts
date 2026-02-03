/**
 * Telegram IPC Client
 *
 * Client for communicating with the Telegram bot daemon over Unix socket.
 * Used by MCP tools to send commands to the daemon.
 */

import { createConnection, Socket } from 'net';
import { existsSync } from 'fs';
import { getSocketPath, isDaemonRunning } from './daemon.js';
import {
  IPCRequest,
  IPCResponse,
  IPCMethod,
  createRequest,
  parseResponse,
  serialize,
} from './protocol.js';
import type {
  BotStatus,
  SendResult,
  PollOptions,
  SendOptions,
  PairOptions,
} from './types.js';
import type { PollResult, PairResult } from './protocol.js';

/**
 * Default timeout for IPC requests (5 seconds)
 */
const DEFAULT_TIMEOUT = 5000;

/**
 * Send an IPC request to the daemon and wait for response
 */
export async function sendRequest(
  method: IPCMethod,
  params?: Record<string, unknown>,
  timeout: number = DEFAULT_TIMEOUT
): Promise<IPCResponse> {
  const socketPath = getSocketPath();

  // Check if socket exists
  if (!existsSync(socketPath)) {
    if (!isDaemonRunning()) {
      throw new Error('Telegram bot daemon is not running. Start it with: mudpuppy telegram start');
    }
    throw new Error('Socket file not found but daemon appears running. Try restarting the daemon.');
  }

  return new Promise((resolve, reject) => {
    const request = createRequest(method, params);
    let socket: Socket | null = null;
    let buffer = '';
    let resolved = false;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket?.destroy();
        reject(new Error(`IPC request timed out after ${timeout}ms`));
      }
    }, timeout);

    const cleanup = () => {
      clearTimeout(timeoutId);
      if (socket) {
        socket.removeAllListeners();
        socket.destroy();
      }
    };

    try {
      socket = createConnection(socketPath);

      socket.on('connect', () => {
        // Send the request
        socket!.write(serialize(request));
      });

      socket.on('data', (data) => {
        buffer += data.toString();

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;

          const response = parseResponse(line);
          if (response && response.id === request.id) {
            if (!resolved) {
              resolved = true;
              cleanup();
              resolve(response);
            }
            return;
          }
        }
      });

      socket.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(new Error(`IPC connection error: ${err.message}`));
        }
      });

      socket.on('close', () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(new Error('IPC connection closed unexpectedly'));
        }
      });
    } catch (err) {
      cleanup();
      throw new Error(`Failed to connect to daemon: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
}

// ============================================
// High-level API functions
// ============================================

/**
 * Check if the daemon is reachable
 */
export async function ping(): Promise<boolean> {
  try {
    const response = await sendRequest('ping', undefined, 2000);
    return response.success && (response.result as { pong: boolean })?.pong === true;
  } catch {
    return false;
  }
}

/**
 * Get bot status
 */
export async function getStatus(): Promise<BotStatus> {
  const response = await sendRequest('status');
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to get status');
  }
  return response.result as BotStatus;
}

/**
 * Poll for messages
 */
export async function pollMessages(options?: PollOptions): Promise<PollResult> {
  const response = await sendRequest('poll', options as Record<string, unknown>);
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to poll messages');
  }
  return response.result as PollResult;
}

/**
 * Send a message
 */
export async function sendMessage(options: SendOptions): Promise<SendResult> {
  const response = await sendRequest('send', options as unknown as Record<string, unknown>);
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to send message');
  }
  return response.result as SendResult;
}

/**
 * Manage pairings
 */
export async function managePairings(options: PairOptions): Promise<PairResult> {
  const response = await sendRequest('pair', options as unknown as Record<string, unknown>);
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to manage pairings');
  }
  return response.result as PairResult;
}

/**
 * Check daemon connectivity and return a status object
 */
export async function checkConnection(): Promise<{
  socketExists: boolean;
  daemonRunning: boolean;
  reachable: boolean;
  status?: BotStatus;
  error?: string;
}> {
  const socketPath = getSocketPath();
  const socketExists = existsSync(socketPath);
  const daemonRunning = isDaemonRunning();

  if (!socketExists || !daemonRunning) {
    return {
      socketExists,
      daemonRunning,
      reachable: false,
      error: daemonRunning ? 'Socket not found' : 'Daemon not running',
    };
  }

  try {
    const status = await getStatus();
    return {
      socketExists: true,
      daemonRunning: true,
      reachable: true,
      status,
    };
  } catch (err) {
    return {
      socketExists: true,
      daemonRunning: true,
      reachable: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
