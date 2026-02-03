/**
 * Autonomy Module Types
 *
 * Type definitions for the heartbeat scheduler and task execution system.
 */

/** Which section a task belongs to in HEARTBEAT.md */
export type TaskSection = 'recurring' | 'one-time' | 'unknown';

/** A parsed task from HEARTBEAT.md */
export interface HeartbeatTask {
  /** Raw text of the task line (without the checkbox prefix) */
  text: string;
  /** Which section the task is under */
  section: TaskSection;
  /** Parsed tool call if task starts with @tool_name */
  toolCall?: { tool: string; input: Record<string, unknown> };
  /** Line index in the original file (0-based) */
  lineIndex: number;
}

/** Current state of the heartbeat scheduler */
export interface HeartbeatState {
  enabled: boolean;
  paused: boolean;
  interval: number;
  lastRun: number | null;
  nextRun: number | null;
  pendingTasks: number;
  inActiveHours: boolean;
}

/** Result of a single heartbeat tick */
export interface HeartbeatResult {
  tasksFound: number;
  tasksExecuted: number;
  tasksFailed: number;
  tasksSkipped: number; // non-executable plain text tasks
  approvalsPending: number;
  actions: ActionResult[];
}

/** Result of executing a single task */
export interface ActionResult {
  task: string;
  tool: string;
  success: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
}

/** Options for creating a HeartbeatScheduler */
export interface HeartbeatOptions {
  interval: number;
  activeHours?: { start: string; end: string; timezone: string };
  maxActionsPerBeat: number;
  requireApproval: boolean;
}
