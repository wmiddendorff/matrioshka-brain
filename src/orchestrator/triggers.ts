/**
 * Orchestrator Trigger Detection
 *
 * Checks multiple sources to determine what the orchestrator should act on.
 */

import { existsSync, readFileSync, statSync } from 'fs';
import { resolvePath } from '../config.js';
import { isInActiveHours } from '../autonomy/scheduler.js';
import type { Trigger, TriggerCheckResult, OrchestratorOptions, OrchestratorState } from './types.js';

const TELEGRAM_QUEUE_PATH = 'telegram-queue.jsonl';
const CRON_JOBS_PATH = 'cron/jobs.json';
const ORCHESTRATOR_STATE_PATH = 'orchestrator/state.json';

/** Default heartbeat interval: 15 minutes */
const DEFAULT_HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Read orchestrator state (last heartbeat time, etc.)
 */
export function readOrchestratorState(): OrchestratorState {
  const statePath = resolvePath(ORCHESTRATOR_STATE_PATH);
  if (!existsSync(statePath)) return {};
  try {
    return JSON.parse(readFileSync(statePath, 'utf-8')) as OrchestratorState;
  } catch {
    return {};
  }
}

/**
 * Check for pending Telegram messages in the queue file.
 */
function checkTelegram(): Trigger | null {
  const queuePath = resolvePath(TELEGRAM_QUEUE_PATH);
  if (!existsSync(queuePath)) return null;

  try {
    const stat = statSync(queuePath);
    if (stat.size === 0) return null;

    const content = readFileSync(queuePath, 'utf-8').trim();
    if (!content) return null;

    const lines = content.split('\n').filter((l) => l.trim());
    if (lines.length === 0) return null;

    return {
      type: 'telegram',
      summary: `${lines.length} pending Telegram message(s)`,
      priority: 10,
      data: { count: lines.length },
    };
  } catch {
    return null;
  }
}

/**
 * Check if heartbeat interval has elapsed.
 */
function checkHeartbeat(
  state: OrchestratorState,
  intervalMs: number,
  now: number
): Trigger | null {
  const lastRun = state.lastHeartbeatAt ?? 0;
  const elapsed = now - lastRun;

  if (elapsed < intervalMs) return null;

  return {
    type: 'heartbeat',
    summary: 'Heartbeat interval elapsed',
    priority: 1,
  };
}

/**
 * Check for due cron jobs.
 */
function checkCron(now: number): Trigger | null {
  const jobsPath = resolvePath(CRON_JOBS_PATH);
  if (!existsSync(jobsPath)) return null;

  try {
    const content = readFileSync(jobsPath, 'utf-8');
    const jobs = JSON.parse(content) as Array<{
      id: string;
      description?: string;
      enabled?: boolean;
      nextRun?: number;
      runAt?: number;
    }>;

    const dueJobs = jobs.filter((job) => {
      if (job.enabled === false) return false;
      const runTime = job.nextRun ?? job.runAt;
      return runTime != null && runTime <= now;
    });

    if (dueJobs.length === 0) return null;

    return {
      type: 'cron',
      summary: `${dueJobs.length} cron job(s) due`,
      priority: 5,
      data: { jobs: dueJobs },
    };
  } catch {
    return null;
  }
}

/**
 * Check if we're in quiet hours.
 */
function isInQuietHours(config?: { start: string; end: string; timezone: string }): boolean {
  if (!config) return false;
  // Quiet hours = the inverse of active hours
  return !isInActiveHours(config);
}

export interface TriggerConfig {
  telegram?: boolean;
  heartbeat?: boolean;
  cron?: boolean;
  heartbeatIntervalMs?: number;
  quietHours?: { start: string; end: string; timezone: string };
}

/**
 * Detect all active triggers.
 */
export function detectTriggers(
  options: OrchestratorOptions,
  config: TriggerConfig = {}
): TriggerCheckResult {
  const now = options.now ?? Date.now();
  const triggers: Trigger[] = [];
  const suppressed: Trigger[] = [];

  const quiet = isInQuietHours(config.quietHours);

  // Manual task — highest priority, ignores quiet hours
  if (options.manualTask) {
    triggers.push({
      type: 'manual',
      summary: options.manualTask.slice(0, 100),
      priority: 100,
      data: options.manualTask,
    });
  }

  // Telegram — high priority, ignores quiet hours
  if (config.telegram !== false || options.forceTelegram) {
    const t = checkTelegram();
    if (t) triggers.push(t);
  }

  // Heartbeat — respects quiet hours
  if (config.heartbeat !== false || options.forceHeartbeat) {
    const state = readOrchestratorState();
    const intervalMs = config.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
    const t = checkHeartbeat(state, intervalMs, now);
    if (t) {
      if (quiet && !options.forceHeartbeat) {
        suppressed.push(t);
      } else {
        triggers.push(t);
      }
    }
  }

  // Cron — respects quiet hours
  if (config.cron !== false || options.forceCron) {
    const t = checkCron(now);
    if (t) {
      if (quiet && !options.forceCron) {
        suppressed.push(t);
      } else {
        triggers.push(t);
      }
    }
  }

  // Sort by priority descending
  triggers.sort((a, b) => b.priority - a.priority);

  return { triggers, suppressed };
}
