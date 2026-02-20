/**
 * Lockfile Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TEST_HOME = join(tmpdir(), `mb-test-lock-${Date.now()}-${Math.random().toString(36).slice(2)}`);
process.env.MATRIOSHKA_BRAIN_HOME = TEST_HOME;

import {
  acquireLock,
  releaseLock,
  forceUnlock,
  getLockStatus,
  isProcessRunning,
  readLock,
  getLockPath,
  isLockStale,
} from '../../src/orchestrator/lockfile.js';

describe('lockfile', () => {
  beforeEach(() => {
    mkdirSync(TEST_HOME, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_HOME, { recursive: true, force: true });
  });

  describe('acquireLock', () => {
    it('creates a lock file with current PID', () => {
      const lock = acquireLock();
      expect(lock.pid).toBe(process.pid);
      expect(lock.createdAt).toBeGreaterThan(0);
      expect(existsSync(getLockPath())).toBe(true);
    });

    it('throws if lock already held by running process', () => {
      acquireLock();
      expect(() => acquireLock()).toThrow(/already running/i);
    });

    it('replaces stale lock (dead PID)', () => {
      const lockPath = getLockPath();
      writeFileSync(lockPath, JSON.stringify({ pid: 999999999, createdAt: Date.now() }));
      const lock = acquireLock();
      expect(lock.pid).toBe(process.pid);
    });

    it('replaces stale lock (expired timeout)', () => {
      const lockPath = getLockPath();
      writeFileSync(lockPath, JSON.stringify({ pid: process.pid, createdAt: Date.now() - 999999999 }));
      const lock = acquireLock({ lockTimeoutMs: 1000 });
      expect(lock.pid).toBe(process.pid);
    });

    it('force acquires even if lock is active', () => {
      acquireLock();
      const lock = acquireLock({ force: true });
      expect(lock.pid).toBe(process.pid);
    });
  });

  describe('releaseLock', () => {
    it('removes lock file', () => {
      acquireLock();
      releaseLock();
      expect(existsSync(getLockPath())).toBe(false);
    });

    it('does not remove lock owned by another PID', () => {
      const lockPath = getLockPath();
      mkdirSync(join(TEST_HOME), { recursive: true });
      writeFileSync(lockPath, JSON.stringify({ pid: 999999999, createdAt: Date.now() }));
      releaseLock();
      expect(existsSync(lockPath)).toBe(true);
    });

    it('is safe to call when no lock exists', () => {
      expect(() => releaseLock()).not.toThrow();
    });
  });

  describe('forceUnlock', () => {
    it('removes lock regardless of owner', () => {
      const lockPath = getLockPath();
      mkdirSync(join(TEST_HOME), { recursive: true });
      writeFileSync(lockPath, JSON.stringify({ pid: 999999999, createdAt: Date.now() }));
      forceUnlock();
      expect(existsSync(lockPath)).toBe(false);
    });
  });

  describe('getLockStatus', () => {
    it('returns unlocked when no file', () => {
      const status = getLockStatus();
      expect(status.locked).toBe(false);
      expect(status.stale).toBe(false);
    });

    it('returns locked for active lock', () => {
      acquireLock();
      const status = getLockStatus();
      expect(status.locked).toBe(true);
      expect(status.stale).toBe(false);
    });

    it('returns stale for dead PID', () => {
      const lockPath = getLockPath();
      mkdirSync(join(TEST_HOME), { recursive: true });
      writeFileSync(lockPath, JSON.stringify({ pid: 999999999, createdAt: Date.now() }));
      const status = getLockStatus();
      expect(status.locked).toBe(false);
      expect(status.stale).toBe(true);
    });
  });

  describe('isProcessRunning', () => {
    it('returns true for current process', () => {
      expect(isProcessRunning(process.pid)).toBe(true);
    });

    it('returns false for dead PID', () => {
      expect(isProcessRunning(999999999)).toBe(false);
    });
  });
});
