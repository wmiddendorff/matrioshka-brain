/**
 * Autonomy & Audit Module Tests
 *
 * Tests for heartbeat parser, active hours, scheduler, audit logger,
 * and integration (parse → execute → audit → verify).
 * Uses temp directories for isolation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// ============================================
// Heartbeat Parser
// ============================================

describe('Heartbeat Parser', () => {
  it('returns empty array for empty document', async () => {
    const { parseHeartbeatMd } = await import('../src/autonomy/parser.js');
    expect(parseHeartbeatMd('')).toEqual([]);
  });

  it('returns empty array for document with no tasks', async () => {
    const { parseHeartbeatMd } = await import('../src/autonomy/parser.js');
    const content = '# Heartbeat Tasks\n\nSome text here.\n';
    expect(parseHeartbeatMd(content)).toEqual([]);
  });

  it('extracts unchecked tasks', async () => {
    const { parseHeartbeatMd } = await import('../src/autonomy/parser.js');
    const content = '- [ ] Task one\n- [ ] Task two\n';
    const tasks = parseHeartbeatMd(content);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].text).toBe('Task one');
    expect(tasks[1].text).toBe('Task two');
  });

  it('skips checked tasks', async () => {
    const { parseHeartbeatMd } = await import('../src/autonomy/parser.js');
    const content = '- [x] Done task\n- [ ] Pending task\n';
    const tasks = parseHeartbeatMd(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].text).toBe('Pending task');
  });

  it('detects @tool prefix without args', async () => {
    const { parseHeartbeatMd } = await import('../src/autonomy/parser.js');
    const content = '- [ ] @telegram_poll\n';
    const tasks = parseHeartbeatMd(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].toolCall).toEqual({ tool: 'telegram_poll', input: {} });
  });

  it('detects @tool prefix with JSON args', async () => {
    const { parseHeartbeatMd } = await import('../src/autonomy/parser.js');
    const content = '- [ ] @telegram_send {"userId":123,"text":"Hello"}\n';
    const tasks = parseHeartbeatMd(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].toolCall).toEqual({
      tool: 'telegram_send',
      input: { userId: 123, text: 'Hello' },
    });
  });

  it('treats malformed JSON args as plain text task', async () => {
    const { parseHeartbeatMd } = await import('../src/autonomy/parser.js');
    const content = '- [ ] @some_tool {invalid json}\n';
    const tasks = parseHeartbeatMd(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].toolCall).toBeUndefined();
  });

  it('plain text tasks have no toolCall', async () => {
    const { parseHeartbeatMd } = await import('../src/autonomy/parser.js');
    const content = '- [ ] Check for important notifications\n';
    const tasks = parseHeartbeatMd(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].toolCall).toBeUndefined();
    expect(tasks[0].text).toBe('Check for important notifications');
  });

  it('detects recurring section', async () => {
    const { parseHeartbeatMd } = await import('../src/autonomy/parser.js');
    const content = '## Recurring\n- [ ] @telegram_poll\n';
    const tasks = parseHeartbeatMd(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].section).toBe('recurring');
  });

  it('detects one-time section', async () => {
    const { parseHeartbeatMd } = await import('../src/autonomy/parser.js');
    const content = '## One-time\n- [ ] @memory_stats\n';
    const tasks = parseHeartbeatMd(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].section).toBe('one-time');
  });

  it('defaults to unknown section', async () => {
    const { parseHeartbeatMd } = await import('../src/autonomy/parser.js');
    const content = '- [ ] Orphan task\n';
    const tasks = parseHeartbeatMd(content);
    expect(tasks[0].section).toBe('unknown');
  });

  it('tracks correct lineIndex', async () => {
    const { parseHeartbeatMd } = await import('../src/autonomy/parser.js');
    const content = '# Title\n\n## Recurring\n- [ ] First\n- [x] Done\n- [ ] Second\n';
    const tasks = parseHeartbeatMd(content);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].lineIndex).toBe(3);
    expect(tasks[1].lineIndex).toBe(5);
  });

  it('handles mixed sections correctly', async () => {
    const { parseHeartbeatMd } = await import('../src/autonomy/parser.js');
    const content = [
      '# Heartbeat Tasks',
      '',
      '## Recurring',
      '- [ ] @telegram_poll',
      '- [ ] Check manually',
      '',
      '## One-time',
      '- [ ] @telegram_send {"userId":1,"text":"Hi"}',
      '- [x] Already done',
      '',
      '---',
      'HEARTBEAT_OK',
    ].join('\n');

    const tasks = parseHeartbeatMd(content);
    expect(tasks).toHaveLength(3);
    expect(tasks[0].section).toBe('recurring');
    expect(tasks[0].toolCall?.tool).toBe('telegram_poll');
    expect(tasks[1].section).toBe('recurring');
    expect(tasks[1].toolCall).toBeUndefined();
    expect(tasks[2].section).toBe('one-time');
    expect(tasks[2].toolCall?.tool).toBe('telegram_send');
  });
});

// ============================================
// markTaskDone
// ============================================

describe('markTaskDone', () => {
  it('replaces unchecked with checked at given line', async () => {
    const { markTaskDone } = await import('../src/autonomy/parser.js');
    const content = '- [ ] Task A\n- [ ] Task B\n';
    const result = markTaskDone(content, 0);
    expect(result).toBe('- [x] Task A\n- [ ] Task B\n');
  });

  it('handles out-of-range line index gracefully', async () => {
    const { markTaskDone } = await import('../src/autonomy/parser.js');
    const content = '- [ ] Only task\n';
    expect(markTaskDone(content, 5)).toBe(content);
    expect(markTaskDone(content, -1)).toBe(content);
  });

  it('does not change already checked lines', async () => {
    const { markTaskDone } = await import('../src/autonomy/parser.js');
    const content = '- [x] Done\n- [ ] Pending\n';
    const result = markTaskDone(content, 0);
    expect(result).toBe('- [x] Done\n- [ ] Pending\n');
  });
});

// ============================================
// Active Hours
// ============================================

describe('isInActiveHours', () => {
  it('returns true when no config provided', async () => {
    const { isInActiveHours } = await import('../src/autonomy/scheduler.js');
    expect(isInActiveHours()).toBe(true);
    expect(isInActiveHours(undefined)).toBe(true);
  });

  it('returns true during active hours', async () => {
    const { isInActiveHours } = await import('../src/autonomy/scheduler.js');

    // Get current hour in UTC and create a window around it
    const now = new Date();
    const utcHour = now.getUTCHours();
    const start = `${String((utcHour - 1 + 24) % 24).padStart(2, '0')}:00`;
    const end = `${String((utcHour + 1) % 24).padStart(2, '0')}:00`;

    expect(isInActiveHours({ start, end, timezone: 'UTC' })).toBe(true);
  });

  it('returns false outside active hours', async () => {
    const { isInActiveHours } = await import('../src/autonomy/scheduler.js');

    // Get current hour in UTC and create a window that excludes it
    const now = new Date();
    const utcHour = now.getUTCHours();
    const start = `${String((utcHour + 2) % 24).padStart(2, '0')}:00`;
    const end = `${String((utcHour + 4) % 24).padStart(2, '0')}:00`;

    expect(isInActiveHours({ start, end, timezone: 'UTC' })).toBe(false);
  });

  it('handles midnight crossing', async () => {
    const { isInActiveHours } = await import('../src/autonomy/scheduler.js');

    // 22:00 - 06:00 should include midnight hours
    const now = new Date();
    const utcHour = now.getUTCHours();

    if (utcHour >= 22 || utcHour < 6) {
      expect(isInActiveHours({ start: '22:00', end: '06:00', timezone: 'UTC' })).toBe(true);
    } else {
      expect(isInActiveHours({ start: '22:00', end: '06:00', timezone: 'UTC' })).toBe(false);
    }
  });

  it('handles timezone parameter', async () => {
    const { isInActiveHours } = await import('../src/autonomy/scheduler.js');

    // Use a wide range that covers most hours to verify timezone is respected
    // This just checks it doesn't throw with a valid timezone
    const result = isInActiveHours({ start: '00:00', end: '23:59', timezone: 'America/New_York' });
    expect(typeof result).toBe('boolean');
    expect(result).toBe(true); // 00:00-23:59 covers almost all day
  });
});

// ============================================
// Audit Logger
// ============================================

describe('Audit Logger', () => {
  let tempDir: string;
  let originalEnv: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'mudpuppy-audit-test-'));
    originalEnv = process.env.MUDPUPPY_HOME;
    process.env.MUDPUPPY_HOME = tempDir;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.MUDPUPPY_HOME = originalEnv;
    } else {
      delete process.env.MUDPUPPY_HOME;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes JSONL entries to audit log', async () => {
    const { auditLog } = await import('../src/audit/logger.js');

    auditLog({
      timestamp: 1000,
      tool: 'test_tool',
      input: { key: 'value' },
      output: { result: 'ok' },
      source: 'heartbeat',
      durationMs: 42,
      success: true,
    });

    const logPath = join(tempDir, 'data', 'audit.log');
    expect(existsSync(logPath)).toBe(true);

    const content = readFileSync(logPath, 'utf-8');
    const entry = JSON.parse(content.trim());
    expect(entry.tool).toBe('test_tool');
    expect(entry.durationMs).toBe(42);
    expect(entry.success).toBe(true);
  });

  it('appends multiple entries', async () => {
    const { auditLog } = await import('../src/audit/logger.js');

    for (let i = 0; i < 3; i++) {
      auditLog({
        timestamp: 1000 + i,
        tool: `tool_${i}`,
        input: {},
        output: {},
        source: 'heartbeat',
        durationMs: i,
        success: true,
      });
    }

    const logPath = join(tempDir, 'data', 'audit.log');
    const lines = readFileSync(logPath, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(3);
  });

  it('getRecentAuditEntries reads entries newest first', async () => {
    const { auditLog, getRecentAuditEntries } = await import('../src/audit/logger.js');

    auditLog({ timestamp: 1, tool: 'a', input: {}, output: {}, source: 'cli', durationMs: 0, success: true });
    auditLog({ timestamp: 2, tool: 'b', input: {}, output: {}, source: 'cli', durationMs: 0, success: true });
    auditLog({ timestamp: 3, tool: 'c', input: {}, output: {}, source: 'cli', durationMs: 0, success: true });

    const entries = getRecentAuditEntries(2);
    expect(entries).toHaveLength(2);
    expect(entries[0].tool).toBe('c'); // newest first
    expect(entries[1].tool).toBe('b');
  });

  it('getRecentAuditEntries returns empty for missing file', async () => {
    const { getRecentAuditEntries } = await import('../src/audit/logger.js');
    const entries = getRecentAuditEntries();
    expect(entries).toEqual([]);
  });

  it('creates data directory if missing', async () => {
    const { auditLog } = await import('../src/audit/logger.js');

    // Ensure data dir doesn't exist
    const dataDir = join(tempDir, 'data');
    expect(existsSync(dataDir)).toBe(false);

    auditLog({
      timestamp: 1,
      tool: 'test',
      input: {},
      output: {},
      source: 'heartbeat',
      durationMs: 0,
      success: true,
    });

    expect(existsSync(dataDir)).toBe(true);
  });
});

// ============================================
// HeartbeatScheduler
// ============================================

describe('HeartbeatScheduler', () => {
  let tempDir: string;
  let originalEnv: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'mudpuppy-sched-test-'));
    originalEnv = process.env.MUDPUPPY_HOME;
    process.env.MUDPUPPY_HOME = tempDir;

    // Create workspace directory with a HEARTBEAT.md
    mkdirSync(join(tempDir, 'workspace'), { recursive: true });
    mkdirSync(join(tempDir, 'data'), { recursive: true });
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.MUDPUPPY_HOME = originalEnv;
    } else {
      delete process.env.MUDPUPPY_HOME;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('getState returns correct initial state', async () => {
    const { HeartbeatScheduler } = await import('../src/autonomy/scheduler.js');

    const scheduler = new HeartbeatScheduler({
      interval: 60000,
      maxActionsPerBeat: 5,
      requireApproval: false,
    });

    const state = scheduler.getState();
    expect(state.enabled).toBe(false); // not started yet
    expect(state.paused).toBe(false);
    expect(state.interval).toBe(60000);
    expect(state.lastRun).toBeNull();

    scheduler.stop();
  });

  it('start/stop toggles enabled state', async () => {
    const { HeartbeatScheduler } = await import('../src/autonomy/scheduler.js');

    const scheduler = new HeartbeatScheduler({
      interval: 60000,
      maxActionsPerBeat: 5,
      requireApproval: false,
    });

    scheduler.start();
    expect(scheduler.getState().enabled).toBe(true);
    expect(scheduler.getState().nextRun).not.toBeNull();

    scheduler.stop();
    expect(scheduler.getState().enabled).toBe(false);
    expect(scheduler.getState().nextRun).toBeNull();
  });

  it('pause/resume toggles paused state', async () => {
    const { HeartbeatScheduler } = await import('../src/autonomy/scheduler.js');

    const scheduler = new HeartbeatScheduler({
      interval: 60000,
      maxActionsPerBeat: 5,
      requireApproval: false,
    });

    scheduler.start();
    expect(scheduler.getState().paused).toBe(false);

    const wasPaused = scheduler.pause();
    expect(wasPaused).toBe(false);
    expect(scheduler.getState().paused).toBe(true);

    scheduler.resume();
    expect(scheduler.getState().paused).toBe(false);

    scheduler.stop();
  });

  it('tick skips execution when paused', async () => {
    const { HeartbeatScheduler } = await import('../src/autonomy/scheduler.js');

    writeFileSync(
      join(tempDir, 'workspace', 'HEARTBEAT.md'),
      '## Recurring\n- [ ] @config_get\n'
    );

    const scheduler = new HeartbeatScheduler({
      interval: 60000,
      maxActionsPerBeat: 5,
      requireApproval: false,
    });

    scheduler.pause();
    const result = await scheduler._tick();
    expect(result.tasksFound).toBe(0); // skipped entirely
    expect(result.tasksExecuted).toBe(0);

    scheduler.stop();
  });

  it('tick executes @tool tasks without approval', async () => {
    const { HeartbeatScheduler } = await import('../src/autonomy/scheduler.js');

    writeFileSync(
      join(tempDir, 'workspace', 'HEARTBEAT.md'),
      '## Recurring\n- [ ] @config_get\n'
    );

    const scheduler = new HeartbeatScheduler({
      interval: 60000,
      maxActionsPerBeat: 5,
      requireApproval: false,
    });

    const result = await scheduler._tick();
    expect(result.tasksFound).toBe(1);
    expect(result.tasksExecuted).toBe(1);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].tool).toBe('config_get');
    expect(result.actions[0].success).toBe(true);

    scheduler.stop();
  });

  it('tick skips plain text tasks', async () => {
    const { HeartbeatScheduler } = await import('../src/autonomy/scheduler.js');

    writeFileSync(
      join(tempDir, 'workspace', 'HEARTBEAT.md'),
      '## Recurring\n- [ ] Check manually\n'
    );

    const scheduler = new HeartbeatScheduler({
      interval: 60000,
      maxActionsPerBeat: 5,
      requireApproval: false,
    });

    const result = await scheduler._tick();
    expect(result.tasksFound).toBe(1);
    expect(result.tasksSkipped).toBe(1);
    expect(result.tasksExecuted).toBe(0);

    scheduler.stop();
  });

  it('tick respects maxActionsPerBeat', async () => {
    const { HeartbeatScheduler } = await import('../src/autonomy/scheduler.js');

    writeFileSync(
      join(tempDir, 'workspace', 'HEARTBEAT.md'),
      '## Recurring\n- [ ] @config_get\n- [ ] @config_get\n- [ ] @config_get\n'
    );

    const scheduler = new HeartbeatScheduler({
      interval: 60000,
      maxActionsPerBeat: 2,
      requireApproval: false,
    });

    const result = await scheduler._tick();
    expect(result.tasksExecuted).toBe(2);
    expect(result.actions).toHaveLength(2);

    scheduler.stop();
  });

  it('tick handles failed tool calls without crashing', async () => {
    const { HeartbeatScheduler } = await import('../src/autonomy/scheduler.js');

    writeFileSync(
      join(tempDir, 'workspace', 'HEARTBEAT.md'),
      '## Recurring\n- [ ] @nonexistent_tool\n'
    );

    const scheduler = new HeartbeatScheduler({
      interval: 60000,
      maxActionsPerBeat: 5,
      requireApproval: false,
    });

    const result = await scheduler._tick();
    expect(result.tasksFound).toBe(1);
    expect(result.tasksFailed).toBe(1);
    expect(result.tasksExecuted).toBe(0);
    expect(result.actions[0].success).toBe(false);
    expect(result.actions[0].error).toContain('nonexistent_tool');

    scheduler.stop();
  });

  it('tick marks one-time tasks as done', async () => {
    const { HeartbeatScheduler } = await import('../src/autonomy/scheduler.js');

    writeFileSync(
      join(tempDir, 'workspace', 'HEARTBEAT.md'),
      '## One-time\n- [ ] @config_get\n'
    );

    const scheduler = new HeartbeatScheduler({
      interval: 60000,
      maxActionsPerBeat: 5,
      requireApproval: false,
    });

    const result = await scheduler._tick();
    expect(result.tasksExecuted).toBe(1);

    // Verify the file was updated
    const content = readFileSync(join(tempDir, 'workspace', 'HEARTBEAT.md'), 'utf-8');
    expect(content).toContain('- [x] @config_get');

    scheduler.stop();
  });

  it('tick does NOT mark recurring tasks as done', async () => {
    const { HeartbeatScheduler } = await import('../src/autonomy/scheduler.js');

    writeFileSync(
      join(tempDir, 'workspace', 'HEARTBEAT.md'),
      '## Recurring\n- [ ] @config_get\n'
    );

    const scheduler = new HeartbeatScheduler({
      interval: 60000,
      maxActionsPerBeat: 5,
      requireApproval: false,
    });

    await scheduler._tick();

    // Verify the file was NOT modified
    const content = readFileSync(join(tempDir, 'workspace', 'HEARTBEAT.md'), 'utf-8');
    expect(content).toContain('- [ ] @config_get');

    scheduler.stop();
  });

  it('tick writes audit log entries', async () => {
    const { HeartbeatScheduler } = await import('../src/autonomy/scheduler.js');

    writeFileSync(
      join(tempDir, 'workspace', 'HEARTBEAT.md'),
      '## Recurring\n- [ ] @config_get\n'
    );

    const scheduler = new HeartbeatScheduler({
      interval: 60000,
      maxActionsPerBeat: 5,
      requireApproval: false,
    });

    await scheduler._tick();

    // Check audit log exists and has entries
    const logPath = join(tempDir, 'data', 'audit.log');
    expect(existsSync(logPath)).toBe(true);

    const lines = readFileSync(logPath, 'utf-8').trim().split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(2); // action + summary

    const actionEntry = JSON.parse(lines[0]);
    expect(actionEntry.tool).toBe('config_get');
    expect(actionEntry.source).toBe('heartbeat');
    expect(actionEntry.success).toBe(true);

    scheduler.stop();
  });

  it('tick updates lastRun timestamp', async () => {
    const { HeartbeatScheduler } = await import('../src/autonomy/scheduler.js');

    const scheduler = new HeartbeatScheduler({
      interval: 60000,
      maxActionsPerBeat: 5,
      requireApproval: false,
    });

    expect(scheduler.getState().lastRun).toBeNull();

    await scheduler._tick();

    expect(scheduler.getState().lastRun).not.toBeNull();
    expect(scheduler.getState().lastRun!).toBeGreaterThan(0);

    scheduler.stop();
  });

  it('tick handles missing HEARTBEAT.md gracefully', async () => {
    const { HeartbeatScheduler } = await import('../src/autonomy/scheduler.js');

    // Remove the file if it exists
    const filePath = join(tempDir, 'workspace', 'HEARTBEAT.md');
    if (existsSync(filePath)) {
      rmSync(filePath);
    }

    const scheduler = new HeartbeatScheduler({
      interval: 60000,
      maxActionsPerBeat: 5,
      requireApproval: false,
    });

    const result = await scheduler._tick();
    expect(result.tasksFound).toBe(0);
    expect(result.tasksExecuted).toBe(0);

    scheduler.stop();
  });
});

// ============================================
// Integration: Full Beat Cycle
// ============================================

describe('Integration: Full Heartbeat Cycle', () => {
  let tempDir: string;
  let originalEnv: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'mudpuppy-int-test-'));
    originalEnv = process.env.MUDPUPPY_HOME;
    process.env.MUDPUPPY_HOME = tempDir;
    mkdirSync(join(tempDir, 'workspace'), { recursive: true });
    mkdirSync(join(tempDir, 'data'), { recursive: true });
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.MUDPUPPY_HOME = originalEnv;
    } else {
      delete process.env.MUDPUPPY_HOME;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('full cycle: parse → execute → audit → mark done', async () => {
    const { HeartbeatScheduler } = await import('../src/autonomy/scheduler.js');
    const { getRecentAuditEntries } = await import('../src/audit/logger.js');

    const heartbeatContent = [
      '# Heartbeat Tasks',
      '',
      '## Recurring',
      '- [ ] @config_get',
      '- [ ] Check email manually',
      '',
      '## One-time',
      '- [ ] @config_get {"path":"version"}',
      '',
      '---',
      'HEARTBEAT_OK',
    ].join('\n');

    writeFileSync(join(tempDir, 'workspace', 'HEARTBEAT.md'), heartbeatContent);

    const scheduler = new HeartbeatScheduler({
      interval: 60000,
      maxActionsPerBeat: 10,
      requireApproval: false,
    });

    const result = await scheduler._tick();

    // Verify execution results
    expect(result.tasksFound).toBe(3);
    expect(result.tasksExecuted).toBe(2); // 2 @tool tasks
    expect(result.tasksSkipped).toBe(1); // 1 plain text task
    expect(result.tasksFailed).toBe(0);
    expect(result.actions).toHaveLength(2);

    // Verify one-time task was marked done
    const updatedContent = readFileSync(join(tempDir, 'workspace', 'HEARTBEAT.md'), 'utf-8');
    expect(updatedContent).toContain('- [x] @config_get {"path":"version"}');
    // Recurring task should still be unchecked
    expect(updatedContent).toMatch(/## Recurring\n- \[ \] @config_get/);

    // Verify audit log
    const auditEntries = getRecentAuditEntries(10);
    expect(auditEntries.length).toBeGreaterThanOrEqual(3); // 2 actions + 1 summary
    const toolEntries = auditEntries.filter((e) => e.tool !== 'heartbeat_tick');
    expect(toolEntries.every((e) => e.source === 'heartbeat')).toBe(true);

    scheduler.stop();
  });

  it('full cycle with approval required creates approvals instead of executing', async () => {
    const { HeartbeatScheduler } = await import('../src/autonomy/scheduler.js');

    // Set up approval DB
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    const { initApprovalDbFrom, listPendingApprovals, closeApprovalDb } = await import('../src/approval/db.js');
    initApprovalDbFrom(db);

    writeFileSync(
      join(tempDir, 'workspace', 'HEARTBEAT.md'),
      '## Recurring\n- [ ] @config_get\n'
    );

    const scheduler = new HeartbeatScheduler({
      interval: 60000,
      maxActionsPerBeat: 5,
      requireApproval: true,
    });

    const result = await scheduler._tick();

    expect(result.approvalsPending).toBe(1);
    expect(result.tasksExecuted).toBe(0);

    // Verify approval was created
    const pending = listPendingApprovals(db, 'heartbeat_action');
    expect(pending).toHaveLength(1);
    expect(pending[0].payload).toMatchObject({
      tool: 'config_get',
      input: {},
    });

    closeApprovalDb();
    scheduler.stop();
  });

  it('getState reflects pending task count from HEARTBEAT.md', async () => {
    const { HeartbeatScheduler } = await import('../src/autonomy/scheduler.js');

    writeFileSync(
      join(tempDir, 'workspace', 'HEARTBEAT.md'),
      '## Recurring\n- [ ] @config_get\n- [ ] Manual task\n- [x] Done\n'
    );

    const scheduler = new HeartbeatScheduler({
      interval: 60000,
      maxActionsPerBeat: 5,
      requireApproval: false,
    });

    const state = scheduler.getState();
    expect(state.pendingTasks).toBe(2); // 2 unchecked

    scheduler.stop();
  });
});
