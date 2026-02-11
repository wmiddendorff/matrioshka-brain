// Email security type definitions

import { z } from 'zod';

/**
 * Email security configuration schema
 */
export const EmailSecurityConfigSchema = z.object({
  senderWhitelist: z.array(z.string()).default([]).describe('Trusted sender domains/addresses'),
  senderBlacklist: z.array(z.string()).default([]).describe('Blocked sender domains/addresses'),
  defaultAction: z.enum(['summarize-only', 'allow-read', 'allow-send']).default('summarize-only'),
  sendMode: z.enum(['draft-only', 'whitelist-only', 'require-approval']).default('draft-only'),
  autoSendWhitelist: z.array(z.string()).default([]).describe('Recipients that can receive auto-sent emails'),
  maxSendsPerHour: z.number().default(5),
  neverExecuteEmailInstructions: z.boolean().default(true),
  attachmentPolicy: z.enum(['metadata-only', 'allow-download', 'block-all']).default('metadata-only'),
});

export type EmailSecurityConfig = z.infer<typeof EmailSecurityConfigSchema>;

/**
 * Email validation result
 */
export interface EmailValidationResult {
  allowed: boolean;
  reason?: string;
  warnings?: string[];
}

/**
 * Send validation result
 */
export interface SendValidationResult {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
  warnings?: string[];
}

/**
 * Security event for audit logging
 */
export interface SecurityEvent {
  type: 'blocked' | 'warning' | 'allowed';
  operation: string;
  details: Record<string, unknown>;
  timestamp: string;
}
