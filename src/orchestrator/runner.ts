/**
 * Orchestrator Runner
 *
 * Core orchestration logic: acquires lock, detects triggers, builds prompts,
 * spawns Claude Code CLI, captures output, and logs results.
 */

import { spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { resolvePath, getMatrioshkaBrainHome } from '../config.js';
import { acquireLock, releaseLock, getLockStatus } from './lockfile.js';
import { detectTriggers, readOrchestratorState, type TriggerConfig } from './triggers.js';
import { buildPrompt } from './prompts.js';
import { logEntry, rotateLogs, getLastEntry } from './logger.js';
import type { OrchestratorOptions, RunnerResult, OrchestratorStatus, OrchestratorLogEntry, OrchestratorState } from './types.js';

const DEFAULT_MAX_SESSION_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OUTPUT_CHARS = 10_000;
const ORCHESTRATOR_STATE_PATH = 'orchestrator/state.json';

export interface RunnerConfig {
  cli?: string;
  cliArgs?: string[];
  maxSessionDurationMs?: number;
  lockTimeoutMs?: number;
  triggers?: TriggerConfig;
  logRetentionDays?: number;
  /** Override for project directory (defaults to MB repo root) */
  projectDir?: string;
}

/**
 * Write orchestrator state to disk.
 */
function writeOrchestratorState(state: OrchestratorState): void {
  const statePath = resolvePath(ORCHESTRATOR_STATE_PATH);
  const dir = dirname(statePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

/**
 * Summarize output to a limited length.
 */
function summarizeOutput(output: string, maxChars = MAX_OUTPUT_CHARS): string {
  if (output.length <= maxChars) return output;
  const half = Math.floor(maxChars / 2);
  return output.slice(0, half) + '\n...[truncated]...\n' + output.slice(-half);
}

/**
 * Detect the project directory (where .mcp.json lives).
 */
function getProjectDir(override?: string): string {
  if (override) return override;

  // Try __dirname-based resolution (dist/orchestrator/ → repo root)
  const distDir = dirname(new URL(import.meta.url).pathname);
  const candidate = resolve(distDir, '..', '..');
  if (existsSync(resolve(candidate, '.mcp.json')) || existsSync(resolve(candidate, 'package.json'))) {
    return candidate;
  }

  // Fallback to MATRIOSHKA_BRAIN_HOME parent assumption
  return getMatrioshkaBrainHome();
}

/**
 * Spawn Claude Code CLI and capture output.
 */
function spawnCli(
  prompt: string,
  projectDir: string,
  cli: string,
  cliArgs: string[],
  timeoutMs: number
): Promise<{ exitCode: number | null; output: string; timedOut: boolean }> {
  return new Promise((resolveP) => {
    const args = [...cliArgs, prompt];
    const child = spawn(cli, args, {
      cwd: projectDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        MATRIOSHKA_BRAIN_HOME: getMatrioshkaBrainHome(),
      },
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      // Force kill after 10s grace period
      setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
      }, 10_000);
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timer);
      const output = stdout + (stderr ? '\n[stderr]\n' + stderr : '');
      resolveP({ exitCode: code, output, timedOut });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolveP({
        exitCode: null,
        output: `[spawn error] ${err.message}`,
        timedOut: false,
      });
    });
  });
}

/**
 * Run the orchestrator: check triggers, build prompt, spawn CLI.
 */
export async function run(
  options: OrchestratorOptions = {},
  config: RunnerConfig = {}
): Promise<RunnerResult> {
  const cli = config.cli ?? 'claude';
  const cliArgs = config.cliArgs ?? ['-p'];
  const maxDuration = config.maxSessionDurationMs ?? DEFAULT_MAX_SESSION_DURATION_MS;
  const lockTimeout = config.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
  const triggerConfig = config.triggers ?? {};
  const retentionDays = config.logRetentionDays ?? 30;

  // Rotate old logs
  rotateLogs(retentionDays);

  // 1. Acquire lock
  try {
    acquireLock({ lockTimeoutMs: lockTimeout });
  } catch (err) {
    return {
      ran: false,
      reason: err instanceof Error ? err.message : 'Failed to acquire lock',
      triggers: [],
    };
  }

  try {
    // 2. Detect triggers
    const { triggers, suppressed } = detectTriggers(options, triggerConfig);

    if (triggers.length === 0) {
      const suppressedInfo = suppressed.length > 0
        ? ` (${suppressed.length} suppressed by quiet hours)`
        : '';
      return {
        ran: false,
        reason: `No active triggers${suppressedInfo}`,
        triggers: [],
      };
    }

    // 3. Build prompt
    const { prompt, summary } = buildPrompt(triggers);

    // 4. Spawn CLI
    const projectDir = getProjectDir(config.projectDir);
    const startTime = Date.now();
    const result = await spawnCli(prompt, projectDir, cli, cliArgs, maxDuration);
    const durationMs = Date.now() - startTime;

    // 5. Update orchestrator state
    const state = readOrchestratorState();
    state.lastRunAt = Date.now();
    if (triggers.some((t) => t.type === 'heartbeat')) {
      state.lastHeartbeatAt = Date.now();
    }
    writeOrchestratorState(state);

    // 6. Log results
    const entry: OrchestratorLogEntry = {
      timestamp: new Date().toISOString(),
      triggerType: triggers.length === 1 ? triggers[0].type : 'multiple',
      triggerTypes: triggers.map((t) => t.type),
      promptSummary: summary,
      durationMs,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      outputSummary: summarizeOutput(result.output),
      error: result.timedOut ? 'Session timed out' : undefined,
    };
    logEntry(entry);

    return {
      ran: true,
      triggers,
      prompt,
      durationMs,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      output: result.output,
    };
  } finally {
    releaseLock();
  }
}

/**
 * Get the current orchestrator status.
 */
export function getStatus(lockTimeoutMs?: number): OrchestratorStatus {
  const { locked, stale, lock } = getLockStatus(lockTimeoutMs);
  const last = getLastEntry();

  return {
    locked,
    lockPid: lock?.pid,
    lockAgeMs: lock ? Date.now() - lock.createdAt : undefined,
    lockStale: stale || undefined,
    lastRunAt: last ? new Date(last.timestamp).getTime() : undefined,
    lastExitCode: last?.exitCode,
    lastTriggerTypes: last?.triggerTypes,
    lastDurationMs: last?.durationMs,
    lastError: last?.error,
  };
}
