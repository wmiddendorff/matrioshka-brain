/**
 * Orchestrator Module
 *
 * External orchestration layer that triggers Claude Code CLI sessions
 * to interact with Matrioshka Brain's MCP tools.
 */

export { run, getStatus, type RunnerConfig } from './runner.js';
export { detectTriggers, readOrchestratorState, type TriggerConfig } from './triggers.js';
export { buildPrompt } from './prompts.js';
export { acquireLock, releaseLock, forceUnlock, getLockStatus } from './lockfile.js';
export { logEntry, readRecentLogs, getLastEntry, rotateLogs } from './logger.js';
export type {
  Trigger,
  TriggerType,
  TriggerCheckResult,
  OrchestratorOptions,
  RunnerResult,
  OrchestratorStatus,
  OrchestratorLogEntry,
  OrchestratorState,
} from './types.js';
