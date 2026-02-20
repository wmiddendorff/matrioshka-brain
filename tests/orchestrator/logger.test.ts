/**
 * Logger Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TEST_HOME = join(tmpdir(), `mb-test-logger-${Date.now()}-${Math.random().toString(36).slice(2)}`);
process.env.MATRIOSHKA_BRAIN_HOME = TEST_HOME;

import { logEntry, readRecentLogs, getLastEntry, rotateLogs } from '../../src/orchestrator/logger.js';
import type { OrchestratorLogEntry } from '../../src/orchestrator/types.js';

function makeEntry(overrides: Partial<OrchestratorLogEntry> = {}): OrchestratorLogEntry {
  return {
    timestamp: new Date().toISOString(),
    triggerType: 'heartbeat',
    triggerTypes: ['heartbeat'],
    promptSummary: 'test',
    durationMs: 1000,
    exitCode: 0,
    timedOut: false,
    outputSummary: 'done',
    ...overrides,
  };
}

describe('logger', () => {
  beforeEach(() => {
    mkdirSync(TEST_HOME, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_HOME, { recursive: true, force: true });
  });

  it('writes and reads log entries', () => {
    logEntry(makeEntry({ promptSummary: 'first' }));
    logEntry(makeEntry({ promptSummary: 'second' }));

    const logs = readRecentLogs(10);
    expect(logs).toHaveLength(2);
    // Most recent first
    expect(logs[0].promptSummary).toBe('second');
    expect(logs[1].promptSummary).toBe('first');
  });

  it('getLastEntry returns most recent', () => {
    logEntry(makeEntry({ promptSummary: 'old' }));
    logEntry(makeEntry({ promptSummary: 'new' }));

    const last = getLastEntry();
    expect(last?.promptSummary).toBe('new');
  });

  it('returns empty when no logs', () => {
    expect(readRecentLogs()).toEqual([]);
    expect(getLastEntry()).toBeNull();
  });

  it('rotates old logs', () => {
    const dir = join(TEST_HOME, 'logs', 'orchestrator');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '2020-01-01.jsonl'), '{}');
    writeFileSync(join(dir, '2020-06-01.jsonl'), '{}');

    const removed = rotateLogs(1);
    expect(removed).toBe(2);
    expect(existsSync(join(dir, '2020-01-01.jsonl'))).toBe(false);
  });
});
