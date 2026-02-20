/**
 * Trigger Detection Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TEST_HOME = join(tmpdir(), `mb-test-triggers-${Date.now()}-${Math.random().toString(36).slice(2)}`);
process.env.MATRIOSHKA_BRAIN_HOME = TEST_HOME;

import { detectTriggers } from '../../src/orchestrator/triggers.js';

describe('triggers', () => {
  beforeEach(() => {
    mkdirSync(TEST_HOME, { recursive: true });
    mkdirSync(join(TEST_HOME, 'orchestrator'), { recursive: true });
    mkdirSync(join(TEST_HOME, 'cron'), { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_HOME, { recursive: true, force: true });
  });

  it('returns empty when no triggers active', () => {
    // No telegram queue, recent heartbeat, no cron jobs
    writeFileSync(
      join(TEST_HOME, 'orchestrator', 'state.json'),
      JSON.stringify({ lastHeartbeatAt: Date.now() })
    );
    const result = detectTriggers({}, { heartbeatIntervalMs: 60000 });
    expect(result.triggers).toHaveLength(0);
  });

  it('detects manual task', () => {
    // Disable other triggers so only manual fires
    writeFileSync(
      join(TEST_HOME, 'orchestrator', 'state.json'),
      JSON.stringify({ lastHeartbeatAt: Date.now() })
    );
    const result = detectTriggers({ manualTask: 'do something' }, { heartbeat: false, telegram: false, cron: false });
    expect(result.triggers).toHaveLength(1);
    expect(result.triggers[0].type).toBe('manual');
    expect(result.triggers[0].priority).toBe(100);
  });

  it('detects pending telegram messages', () => {
    writeFileSync(
      join(TEST_HOME, 'telegram-queue.jsonl'),
      '{"userId":123,"text":"hello","timestamp":1234567890}\n'
    );
    const result = detectTriggers({}, { telegram: true });
    const tg = result.triggers.find((t) => t.type === 'telegram');
    expect(tg).toBeDefined();
    expect(tg!.priority).toBe(10);
  });

  it('does not detect telegram when disabled', () => {
    writeFileSync(
      join(TEST_HOME, 'telegram-queue.jsonl'),
      '{"userId":123,"text":"hello","timestamp":1234567890}\n'
    );
    const result = detectTriggers({}, { telegram: false });
    expect(result.triggers.find((t) => t.type === 'telegram')).toBeUndefined();
  });

  it('detects heartbeat when interval elapsed', () => {
    writeFileSync(
      join(TEST_HOME, 'orchestrator', 'state.json'),
      JSON.stringify({ lastHeartbeatAt: Date.now() - 20 * 60 * 1000 })
    );
    const result = detectTriggers({}, { heartbeatIntervalMs: 15 * 60 * 1000 });
    expect(result.triggers.find((t) => t.type === 'heartbeat')).toBeDefined();
  });

  it('skips heartbeat when interval not elapsed', () => {
    writeFileSync(
      join(TEST_HOME, 'orchestrator', 'state.json'),
      JSON.stringify({ lastHeartbeatAt: Date.now() - 5 * 60 * 1000 })
    );
    const result = detectTriggers({}, { heartbeatIntervalMs: 15 * 60 * 1000 });
    expect(result.triggers.find((t) => t.type === 'heartbeat')).toBeUndefined();
  });

  it('detects due cron jobs', () => {
    writeFileSync(
      join(TEST_HOME, 'cron', 'jobs.json'),
      JSON.stringify([{ id: 'test', description: 'Test job', nextRun: Date.now() - 1000 }])
    );
    const result = detectTriggers({}, { cron: true });
    expect(result.triggers.find((t) => t.type === 'cron')).toBeDefined();
  });

  it('ignores future cron jobs', () => {
    writeFileSync(
      join(TEST_HOME, 'cron', 'jobs.json'),
      JSON.stringify([{ id: 'test', nextRun: Date.now() + 999999999 }])
    );
    const result = detectTriggers({}, { cron: true });
    expect(result.triggers.find((t) => t.type === 'cron')).toBeUndefined();
  });

  it('sorts triggers by priority (manual > telegram > cron > heartbeat)', () => {
    writeFileSync(
      join(TEST_HOME, 'telegram-queue.jsonl'),
      '{"userId":123,"text":"hello","timestamp":1234567890}\n'
    );
    writeFileSync(
      join(TEST_HOME, 'orchestrator', 'state.json'),
      JSON.stringify({ lastHeartbeatAt: 0 })
    );
    const result = detectTriggers(
      { manualTask: 'do thing' },
      { telegram: true, heartbeat: true, heartbeatIntervalMs: 1 }
    );
    expect(result.triggers.length).toBeGreaterThanOrEqual(2);
    // Manual should be first
    expect(result.triggers[0].type).toBe('manual');
    // Telegram second
    expect(result.triggers[1].type).toBe('telegram');
  });

  it('suppresses heartbeat during quiet hours', () => {
    writeFileSync(
      join(TEST_HOME, 'orchestrator', 'state.json'),
      JSON.stringify({ lastHeartbeatAt: 0 })
    );
    // quietHours uses activeHours format, inverted by triggers.ts
    // Use a tiny active window (03:00-03:01 UTC) so current time is outside = quiet
    const result = detectTriggers(
      { now: Date.now() },
      {
        heartbeat: true,
        heartbeatIntervalMs: 1,
        quietHours: { start: '03:00', end: '03:01', timezone: 'UTC' },
      }
    );
    expect(result.triggers.find((t) => t.type === 'heartbeat')).toBeUndefined();
    expect(result.suppressed.find((t) => t.type === 'heartbeat')).toBeDefined();
  });

  it('force overrides quiet hours', () => {
    writeFileSync(
      join(TEST_HOME, 'orchestrator', 'state.json'),
      JSON.stringify({ lastHeartbeatAt: 0 })
    );
    const result = detectTriggers(
      { forceHeartbeat: true, now: Date.now() },
      {
        heartbeat: true,
        heartbeatIntervalMs: 1,
        quietHours: { start: '03:00', end: '03:01', timezone: 'UTC' },
      }
    );
    expect(result.triggers.find((t) => t.type === 'heartbeat')).toBeDefined();
  });
});
