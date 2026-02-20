/**
 * Orchestrator Types
 *
 * Shared types and schemas for the orchestration layer.
 */

import { z } from 'zod';

export type TriggerType = 'manual' | 'telegram' | 'heartbeat' | 'cron';

export interface Trigger<T = unknown> {
  type: TriggerType;
  summary: string;
  priority: number;
  data?: T;
}

export interface TriggerCheckResult {
  triggers: Trigger[];
  suppressed: Trigger[];
}

export interface OrchestratorOptions {
  manualTask?: string;
  forceHeartbeat?: boolean;
  forceTelegram?: boolean;
  forceCron?: boolean;
  now?: number;
}

export interface RunnerResult {
  ran: boolean;
  reason?: string;
  triggers: Trigger[];
  prompt?: string;
  durationMs?: number;
  exitCode?: number | null;
  timedOut?: boolean;
  output?: string;
  error?: string;
}

export interface OrchestratorStatus {
  locked: boolean;
  lockPid?: number;
  lockAgeMs?: number;
  lockStale?: boolean;
  lastRunAt?: number;
  lastExitCode?: number | null;
  lastTriggerTypes?: TriggerType[];
  lastDurationMs?: number;
  lastError?: string;
}

export interface OrchestratorLogEntry {
  timestamp: string;
  triggerType: TriggerType | 'multiple';
  triggerTypes: TriggerType[];
  promptSummary: string;
  durationMs: number;
  exitCode: number | null;
  timedOut: boolean;
  outputSummary: string;
  tokensUsed?: number;
  error?: string;
}

export const TelegramQueueEntrySchema = z.object({
  userId: z.number().int(),
  username: z.string().optional(),
  text: z.string(),
  timestamp: z.number(),
  messageId: z.number().optional(),
});

export type TelegramQueueEntry = z.infer<typeof TelegramQueueEntrySchema>;

export const CronJobSchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  runAt: z.number().optional(),
  nextRun: z.number().optional(),
  enabled: z.boolean().optional().default(true),
});

export type CronJob = z.infer<typeof CronJobSchema>;

export interface OrchestratorState {
  lastHeartbeatAt?: number;
  lastRunAt?: number;
}
