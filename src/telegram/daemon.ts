/**
 * Telegram Bot Daemon Manager
 *
 * Manages the lifecycle of the Telegram bot daemon process.
 * The daemon runs as a detached child process with a PID file.
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { resolvePath } from '../config.js';

const PID_FILE = 'bot/telegram.pid';
const SOCKET_FILE = 'bot/telegram.sock';
const LOG_FILE = 'bot/telegram.log';

/**
 * Get the path to the PID file
 */
export function getPidPath(): string {
  return resolvePath(PID_FILE);
}

/**
 * Get the path to the Unix socket
 */
export function getSocketPath(): string {
  return resolvePath(SOCKET_FILE);
}

/**
 * Get the path to the log file
 */
export function getLogPath(): string {
  return resolvePath(LOG_FILE);
}

/**
 * Read the daemon PID from file
 * Returns null if file doesn't exist or is invalid
 */
export function readPid(): number | null {
  const pidPath = getPidPath();
  if (!existsSync(pidPath)) {
    return null;
  }

  try {
    const content = readFileSync(pidPath, 'utf-8').trim();
    const pid = parseInt(content, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

/**
 * Write the daemon PID to file
 */
export function writePid(pid: number): void {
  const pidPath = getPidPath();
  const dir = dirname(pidPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(pidPath, String(pid));
}

/**
 * Remove the PID file
 */
export function removePid(): void {
  const pidPath = getPidPath();
  if (existsSync(pidPath)) {
    unlinkSync(pidPath);
  }
}

/**
 * Check if a process with the given PID is running
 */
export function isProcessRunning(pid: number): boolean {
  try {
    // Signal 0 doesn't kill, just checks if process exists
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the daemon is currently running
 */
export function isDaemonRunning(): boolean {
  const pid = readPid();
  if (pid === null) {
    return false;
  }

  if (!isProcessRunning(pid)) {
    // Stale PID file, clean it up
    removePid();
    return false;
  }

  return true;
}

/**
 * Get information about the running daemon
 */
export function getDaemonInfo(): { running: boolean; pid?: number } {
  const pid = readPid();
  if (pid === null) {
    return { running: false };
  }

  if (!isProcessRunning(pid)) {
    removePid();
    return { running: false };
  }

  return { running: true, pid };
}

/**
 * Start the Telegram bot daemon
 * Returns the daemon's PID or throws on error
 */
export async function startDaemon(): Promise<number> {
  // Check if already running
  if (isDaemonRunning()) {
    throw new Error('Daemon is already running');
  }

  // Clean up stale socket file
  const socketPath = getSocketPath();
  if (existsSync(socketPath)) {
    unlinkSync(socketPath);
  }

  // Ensure log directory exists
  const logPath = getLogPath();
  const logDir = dirname(logPath);
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  // Find the bot script
  // In development: src/telegram/bot.ts via tsx
  // In production: dist/telegram/bot.js via node
  const isDev = process.argv[1]?.includes('/src/') || process.argv[1]?.endsWith('.ts');

  let command: string;
  let args: string[];

  if (isDev) {
    // Development: use tsx to run TypeScript directly
    command = 'npx';
    args = ['tsx', join(dirname(new URL(import.meta.url).pathname), 'bot.ts')];
  } else {
    // Production: run compiled JavaScript
    command = process.execPath;
    args = [join(dirname(new URL(import.meta.url).pathname), 'bot.js')];
  }

  // Spawn detached process
  const child = spawn(command, args, {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      MATRIOSHKA_BRAIN_DAEMON: '1',
    },
  });

  // Wait a bit for the process to start
  await new Promise<void>((resolve, reject) => {
    let output = '';

    const timeout = setTimeout(() => {
      reject(new Error('Daemon failed to start within timeout'));
    }, 10000);

    child.stdout?.on('data', (data) => {
      output += data.toString();
      // Look for the "ready" signal from the bot
      if (output.includes('DAEMON_READY')) {
        clearTimeout(timeout);
        resolve();
      }
    });

    child.stderr?.on('data', (data) => {
      output += data.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start daemon: ${err.message}`));
    });

    child.on('exit', (code) => {
      clearTimeout(timeout);
      if (code !== null && code !== 0) {
        reject(new Error(`Daemon exited with code ${code}: ${output}`));
      }
    });
  });

  // Write PID file
  const pid = child.pid!;
  writePid(pid);

  // Detach from parent
  child.unref();

  return pid;
}

/**
 * Stop the Telegram bot daemon
 * Returns true if daemon was stopped, false if it wasn't running
 */
export function stopDaemon(): boolean {
  const pid = readPid();
  if (pid === null) {
    return false;
  }

  if (!isProcessRunning(pid)) {
    removePid();
    return false;
  }

  try {
    // Send SIGTERM for graceful shutdown
    process.kill(pid, 'SIGTERM');

    // Wait a bit for it to stop
    let attempts = 0;
    while (attempts < 50 && isProcessRunning(pid)) {
      // Busy wait (in practice this is fast)
      const start = Date.now();
      while (Date.now() - start < 100) {
        // spin
      }
      attempts++;
    }

    // If still running, force kill
    if (isProcessRunning(pid)) {
      process.kill(pid, 'SIGKILL');
    }

    removePid();

    // Clean up socket
    const socketPath = getSocketPath();
    if (existsSync(socketPath)) {
      unlinkSync(socketPath);
    }

    return true;
  } catch (error) {
    // Process might have died between check and kill
    removePid();
    return false;
  }
}

/**
 * Restart the daemon (stop then start)
 */
export async function restartDaemon(): Promise<number> {
  stopDaemon();
  // Wait a moment for cleanup
  await new Promise((resolve) => setTimeout(resolve, 500));
  return startDaemon();
}
