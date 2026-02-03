/**
 * Telegram Module
 *
 * Provides Telegram integration for Mudpuppy:
 * - Bot daemon that connects to Telegram API
 * - IPC client for MCP tools
 * - Message queue and pairing management
 */

// Types
export type {
  TelegramMessage,
  PairingRequest,
  PairedUser,
  BotStatus,
  SendResult,
  PollOptions,
  SendOptions,
  PairOptions,
} from './types.js';

// Protocol
export type {
  IPCRequest,
  IPCResponse,
  IPCMethod,
  PollResult,
  PairResult,
} from './protocol.js';

export {
  createRequest,
  createSuccessResponse,
  createErrorResponse,
  parseRequest,
  parseResponse,
  serialize,
} from './protocol.js';

// Daemon management
export {
  getPidPath,
  getSocketPath,
  getLogPath,
  readPid,
  writePid,
  removePid,
  isProcessRunning,
  isDaemonRunning,
  getDaemonInfo,
  startDaemon,
  stopDaemon,
  restartDaemon,
} from './daemon.js';

// IPC client
export {
  sendRequest,
  ping,
  getStatus,
  pollMessages,
  sendMessage,
  managePairings,
  checkConnection,
} from './ipc.js';
