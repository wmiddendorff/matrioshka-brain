/**
 * Heartbeat Scheduler
 *
 * Periodically reads HEARTBEAT.md, executes @tool tasks, logs to audit trail,
 * marks one-time tasks as done, and optionally notifies via Telegram.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolvePath } from '../config.js';
import { executeTool } from '../tools/index.js';
import { auditLog } from '../audit/logger.js';
import { parseHeartbeatMd, markTaskDone } from './parser.js';
import type { HeartbeatOptions, HeartbeatState, HeartbeatResult, ActionResult } from './types.js';

const HEARTBEAT_PATH = 'workspace/HEARTBEAT.md';

/** Singleton scheduler instance for tool access */
let schedulerInstance: HeartbeatScheduler | null = null;

/**
 * Get the singleton HeartbeatScheduler instance (if started).
 */
export function getScheduler(): HeartbeatScheduler | null {
  return schedulerInstance;
}

/**
 * Check whether the current time is within the configured active hours.
 * If no activeHours config is provided, always returns true.
 */
export function isInActiveHours(
  config?: { start: string; end: string; timezone: string }
): boolean {
  if (!config) return true;

  const { start, end, timezone } = config;

  // Get current time in the configured timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const hourPart = parts.find((p) => p.type === 'hour');
  const minutePart = parts.find((p) => p.type === 'minute');
  if (!hourPart || !minutePart) return true;

  const currentMinutes = parseInt(hourPart.value) * 60 + parseInt(minutePart.value);

  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // Handle midnight crossing (e.g., 22:00 - 06:00)
  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

export class HeartbeatScheduler {
  private options: HeartbeatOptions;
  private timer: ReturnType<typeof setInterval> | null = null;
  private _paused = false;
  private _lastRun: number | null = null;
  private _nextRun: number | null = null;
  private _lastResult: HeartbeatResult | null = null;

  constructor(options: HeartbeatOptions) {
    this.options = options;
    schedulerInstance = this;
  }

  /** Start the heartbeat interval timer. */
  start(): void {
    if (this.timer) return;
    this._nextRun = Date.now() + this.options.interval;
    this.timer = setInterval(() => {
      this._tick().catch((err) => {
        console.error('Heartbeat tick error:', err);
      });
    }, this.options.interval);
  }

  /** Stop the heartbeat timer. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this._nextRun = null;
    schedulerInstance = null;
  }

  /** Pause execution (timer keeps running but ticks are skipped). */
  pause(): boolean {
    const wasPaused = this._paused;
    this._paused = true;
    return wasPaused;
  }

  /** Resume execution. */
  resume(): void {
    this._paused = false;
    this._nextRun = Date.now() + this.options.interval;
  }

  /** Get the current heartbeat state. */
  getState(): HeartbeatState {
    const inActive = isInActiveHours(this.options.activeHours);
    let pendingTasks = 0;

    try {
      const filePath = resolvePath(HEARTBEAT_PATH);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf-8');
        const tasks = parseHeartbeatMd(content);
        pendingTasks = tasks.length;
      }
    } catch {
      // Non-fatal
    }

    return {
      enabled: this.timer !== null,
      paused: this._paused,
      interval: this.options.interval,
      lastRun: this._lastRun,
      nextRun: this._nextRun,
      pendingTasks,
      inActiveHours: inActive,
    };
  }

  /** Get the result of the last tick (for status reporting). */
  getLastResult(): HeartbeatResult | null {
    return this._lastResult;
  }

  /**
   * Main tick handler. Called by the interval timer.
   * Can also be called directly for testing.
   */
  async _tick(): Promise<HeartbeatResult> {
    const result: HeartbeatResult = {
      tasksFound: 0,
      tasksExecuted: 0,
      tasksFailed: 0,
      tasksSkipped: 0,
      approvalsPending: 0,
      actions: [],
    };

    // Skip if paused
    if (this._paused) {
      this._nextRun = Date.now() + this.options.interval;
      this._lastResult = result;
      return result;
    }

    // Skip if outside active hours
    if (!isInActiveHours(this.options.activeHours)) {
      this._nextRun = Date.now() + this.options.interval;
      this._lastResult = result;
      return result;
    }

    // Read HEARTBEAT.md
    const filePath = resolvePath(HEARTBEAT_PATH);
    if (!existsSync(filePath)) {
      this._lastRun = Date.now();
      this._nextRun = Date.now() + this.options.interval;
      this._lastResult = result;
      return result;
    }

    let content = readFileSync(filePath, 'utf-8');
    const tasks = parseHeartbeatMd(content);
    result.tasksFound = tasks.length;

    let actionsExecuted = 0;
    // Track line offsets from markTaskDone replacements (they don't change line count)
    const completedLineIndices: number[] = [];

    for (const task of tasks) {
      // Respect maxActionsPerBeat
      if (actionsExecuted >= this.options.maxActionsPerBeat) break;

      // Skip non-executable tasks (no @tool prefix)
      if (!task.toolCall) {
        result.tasksSkipped++;
        continue;
      }

      const { tool, input } = task.toolCall;

      // If requireApproval, create an approval instead of executing
      if (this.options.requireApproval) {
        try {
          const { getApprovalDb, createApproval } = await import('../approval/db.js');
          const db = getApprovalDb();
          createApproval(db, 'heartbeat_action', {
            tool,
            input,
            taskText: task.text,
            section: task.section,
          });
          result.approvalsPending++;
        } catch (err) {
          console.error('Failed to create heartbeat approval:', err);
        }
        actionsExecuted++;
        continue;
      }

      // Execute the tool
      const startTime = Date.now();
      const actionResult: ActionResult = {
        task: task.text,
        tool,
        success: false,
        durationMs: 0,
      };

      try {
        const output = await executeTool(tool, input);
        actionResult.success = true;
        actionResult.output = output;
      } catch (err) {
        actionResult.success = false;
        actionResult.error = err instanceof Error ? err.message : String(err);
        result.tasksFailed++;
      }

      actionResult.durationMs = Date.now() - startTime;
      result.actions.push(actionResult);

      if (actionResult.success) {
        result.tasksExecuted++;
      }

      // Log to audit trail
      auditLog({
        timestamp: Date.now(),
        tool,
        input,
        output: actionResult.success
          ? (actionResult.output as Record<string, unknown>) ?? {}
          : { error: actionResult.error },
        source: 'heartbeat',
        durationMs: actionResult.durationMs,
        success: actionResult.success,
        error: actionResult.error,
      });

      // Mark one-time tasks as done
      if (actionResult.success && task.section === 'one-time') {
        completedLineIndices.push(task.lineIndex);
      }

      actionsExecuted++;
    }

    // Apply markTaskDone for completed one-time tasks
    if (completedLineIndices.length > 0) {
      for (const lineIndex of completedLineIndices) {
        content = markTaskDone(content, lineIndex);
      }
      writeFileSync(filePath, content);
    }

    this._lastRun = Date.now();
    this._nextRun = Date.now() + this.options.interval;
    this._lastResult = result;

    // Send Telegram notification if configured
    await this._notifyTelegram(result);

    // Log summary to audit trail
    auditLog({
      timestamp: Date.now(),
      tool: 'heartbeat_tick',
      input: { tasksFound: result.tasksFound },
      output: {
        executed: result.tasksExecuted,
        failed: result.tasksFailed,
        skipped: result.tasksSkipped,
        approvalsPending: result.approvalsPending,
      },
      source: 'heartbeat',
      durationMs: 0,
      success: result.tasksFailed === 0,
    });

    return result;
  }

  /**
   * Send a summary notification to all paired Telegram users.
   * Non-fatal: silently ignores errors.
   */
  private async _notifyTelegram(result: HeartbeatResult): Promise<void> {
    // Only notify if there were actual actions
    if (result.tasksExecuted === 0 && result.tasksFailed === 0 && result.approvalsPending === 0) {
      return;
    }

    try {
      const { checkConnection, managePairings, sendMessage } = await import('../telegram/ipc.js');
      const conn = await checkConnection();
      if (!conn.reachable) return;

      // Build summary message
      const lines: string[] = ['<b>Heartbeat Summary</b>'];
      if (result.tasksExecuted > 0) {
        lines.push(`Executed: ${result.tasksExecuted}`);
      }
      if (result.tasksFailed > 0) {
        lines.push(`Failed: ${result.tasksFailed}`);
      }
      if (result.approvalsPending > 0) {
        lines.push(`Pending approval: ${result.approvalsPending}`);
      }
      if (result.tasksSkipped > 0) {
        lines.push(`Skipped (manual): ${result.tasksSkipped}`);
      }

      // List action details
      for (const action of result.actions) {
        const icon = action.success ? '+' : '!';
        lines.push(`  ${icon} ${action.tool} (${action.durationMs}ms)`);
        if (action.error) {
          lines.push(`    Error: ${action.error}`);
        }
      }

      const text = lines.join('\n');

      // Get paired users and send to each
      const pairResult = await managePairings({ action: 'list' });
      const pairedUsers = pairResult.pairedUsers ?? [];
      for (const user of pairedUsers) {
        try {
          await sendMessage({
            userId: user.id,
            text,
            parseMode: 'HTML',
          });
        } catch {
          // Non-fatal per user
        }
      }
    } catch {
      // Telegram notification is completely optional
    }
  }
}
