// Web server daemon management

import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { resolvePath } from '../config.js';

const PID_FILE = 'data/web.pid';
const LOG_FILE = 'logs/web.log';

export function getPidPath(): string {
  return resolvePath(PID_FILE);
}

export function getLogPath(): string {
  return resolvePath(LOG_FILE);
}

export function readPid(): number | null {
  const pidPath = getPidPath();
  if (!existsSync(pidPath)) return null;

  try {
    const content = readFileSync(pidPath, 'utf-8').trim();
    const pid = parseInt(content, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

export function writePid(pid: number): void {
  const pidPath = getPidPath();
  const dir = dirname(pidPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(pidPath, String(pid));
}

export function removePid(): void {
  const pidPath = getPidPath();
  if (existsSync(pidPath)) {
    unlinkSync(pidPath);
  }
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function isDaemonRunning(): boolean {
  const pid = readPid();
  if (!pid) return false;
  return isProcessRunning(pid);
}

export function getDaemonInfo(): { running: boolean; pid: number | null } {
  const pid = readPid();
  const running = pid ? isProcessRunning(pid) : false;
  return { running, pid: running ? pid : null };
}

export async function startDaemon(port: number = 3456): Promise<void> {
  if (isDaemonRunning()) {
    throw new Error('Web server is already running');
  }

  removePid();

  const logPath = getLogPath();
  const logDir = dirname(logPath);
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  const serverPath = new URL('./run-server.js', import.meta.url).pathname;
  
  const child = spawn(
    process.execPath,
    [serverPath, String(port)],
    {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env },
    }
  );

  child.unref();

  if (child.pid) {
    writePid(child.pid);
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (!isDaemonRunning()) {
    throw new Error('Failed to start web server daemon');
  }
}

export function stopDaemon(): void {
  const pid = readPid();
  if (!pid) {
    throw new Error('Web server is not running');
  }

  try {
    process.kill(pid, 'SIGTERM');
    
    let attempts = 0;
    while (isProcessRunning(pid) && attempts < 10) {
      attempts++;
      const start = Date.now();
      while (Date.now() - start < 100) {}
    }

    if (isProcessRunning(pid)) {
      process.kill(pid, 'SIGKILL');
    }

    removePid();
  } catch (error) {
    throw new Error(`Failed to stop web server: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function restartDaemon(port: number = 3456): Promise<void> {
  if (isDaemonRunning()) {
    stopDaemon();
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  await startDaemon(port);
}
