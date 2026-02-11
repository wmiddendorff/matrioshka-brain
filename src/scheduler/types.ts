// Scheduler type definitions

import { z } from 'zod';

/**
 * Supported platforms
 */
export type Platform = 'darwin' | 'win32' | 'linux';

/**
 * Schedule entry schema
 */
export const ScheduleEntrySchema = z.object({
  id: z.string(),
  name: z.string().describe('Human-readable name for the task'),
  description: z.string().optional(),
  schedule: z.string().describe('Cron expression or time specification'),
  command: z.string().describe('Command to execute'),
  workdir: z.string().optional().describe('Working directory'),
  enabled: z.boolean().default(true),
  createdAt: z.string(),
  platform: z.enum(['darwin', 'win32', 'linux']),
});

export type ScheduleEntry = z.infer<typeof ScheduleEntrySchema>;

/**
 * Schedule registry schema
 */
export const ScheduleRegistrySchema = z.object({
  version: z.string().default('1.0.0'),
  schedules: z.array(ScheduleEntrySchema),
});

export type ScheduleRegistry = z.infer<typeof ScheduleRegistrySchema>;

/**
 * Schedule status
 */
export interface ScheduleStatus {
  id: string;
  name: string;
  enabled: boolean;
  installed: boolean;
  platform: Platform;
  nextRun?: string;
  lastRun?: string;
  errors?: string[];
}
