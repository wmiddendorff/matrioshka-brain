// Web management console type definitions

import { z } from 'zod';

/**
 * Plugin configuration request
 */
export const PluginConfigRequestSchema = z.object({
  name: z.string(),
  enabled: z.boolean().optional(),
  credentials: z.record(z.string()).optional(),
});

export type PluginConfigRequest = z.infer<typeof PluginConfigRequestSchema>;

/**
 * Schedule update request
 */
export const ScheduleUpdateRequestSchema = z.object({
  id: z.string(),
  enabled: z.boolean().optional(),
  schedule: z.string().optional(),
  command: z.string().optional(),
});

export type ScheduleUpdateRequest = z.infer<typeof ScheduleUpdateRequestSchema>;

/**
 * Memory search request
 */
export const MemorySearchRequestSchema = z.object({
  query: z.string(),
  limit: z.number().optional().default(20),
});

export type MemorySearchRequest = z.infer<typeof MemorySearchRequestSchema>;

/**
 * Soul file update request
 */
export const SoulFileUpdateRequestSchema = z.object({
  filename: z.enum(['SOUL.md', 'IDENTITY.md', 'AGENTS.md', 'USER.md', 'HEARTBEAT.md']),
  content: z.string(),
});

export type SoulFileUpdateRequest = z.infer<typeof SoulFileUpdateRequestSchema>;
