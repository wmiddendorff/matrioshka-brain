/**
 * Orchestrator Lockfile
 *
 * PID-based lock to prevent overlapping orchestrator sessions.
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { resolvePath } from '../config.js';

export interface LockInfo {
  pid: number;
  createdAt: number;
  hostname?: string;
}

const DEFAULT_LOCK_TIMEOUT_MS = 10 * 60 * 1000;

export function getLockPath(): string {
  return resolvePath('orchestrator.lock');
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EPERM') return true;
    }
    return false;
  }
}

export function readLock(): LockInfo | null {
  const lockPath = getLockPath();
  if (!existsSync(lockPath)) return null;

  try {
    const content = readFileSync(lockPath, 'utf-8');
    const parsed = JSON.parse(content) as LockInfo;
    if (!parsed.pid || !parsed.createdAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isLockStale(lock: LockInfo, lockTimeoutMs: number): boolean {
  const age = Date.now() - lock.createdAt;
  if (age > lockTimeoutMs) return true;
  return !isProcessRunning(lock.pid);
}

export function getLockStatus(lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS): {
  locked: boolean;
  stale: boolean;
  lock?: LockInfo;
} {
  const lock = readLock();
  if (!lock) return { locked: false, stale: false };

  const stale = isLockStale(lock, lockTimeoutMs);
  return { locked: !stale, stale, lock };
}

export function acquireLock(options?: { lockTimeoutMs?: number; force?: boolean }): LockInfo {
  const lockTimeoutMs = options?.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
  const lockPath = getLockPath();
  const existing = readLock();

  if (existing) {
    const stale = isLockStale(existing, lockTimeoutMs);
    if (!stale && !options?.force) {
      throw new Error(`Orchestrator already running (PID ${existing.pid})`);
    }

    if (stale || options?.force) {
      try {
        unlinkSync(lockPath);
      } catch {
        // ignore
      }
    }
  }

  const dir = dirname(lockPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const lock: LockInfo = {
    pid: process.pid,
    createdAt: Date.now(),
    hostname: process.env.HOSTNAME,
  };

  writeFileSync(lockPath, JSON.stringify(lock));
  return lock;
}

export function releaseLock(): void {
  const lockPath = getLockPath();
  if (!existsSync(lockPath)) return;

  try {
    const existing = readLock();
    if (existing && existing.pid !== process.pid) {
      return;
    }
  } catch {
    // ignore
  }

  try {
    unlinkSync(lockPath);
  } catch {
    // ignore
  }
}

export function forceUnlock(): void {
  const lockPath = getLockPath();
  if (!existsSync(lockPath)) return;
  try {
    unlinkSync(lockPath);
  } catch {
    // ignore
  }
}
