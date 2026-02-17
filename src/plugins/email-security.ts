/**
 * Email Security Guardrails
 */

import { ConfigManager } from '../config.js';

export interface EmailSecurityConfig {
  senderWhitelist: string[];
  senderBlacklist: string[];
  defaultAction: 'summarize-only' | 'read-only' | 'full-access';
  sendMode: 'draft-only' | 'auto-send-whitelist' | 'full-access';
  autoSendWhitelist: string[];
  maxSendsPerHour: number;
  neverExecuteEmailInstructions: boolean;
  attachmentPolicy: 'metadata-only' | 'read-allowed' | 'full-access';
}

export class EmailSecurityGuard {
  private config: ConfigManager;
  private sendHistory: Map<number, number> = new Map();

  constructor() {
    this.config = new ConfigManager();
  }

  getSecurityConfig(): EmailSecurityConfig {
    const emailConfig = this.config.getValue<{ security: EmailSecurityConfig }>('email');
    return emailConfig?.security || {
      senderWhitelist: [],
      senderBlacklist: [],
      defaultAction: 'summarize-only',
      sendMode: 'draft-only',
      autoSendWhitelist: [],
      maxSendsPerHour: 5,
      neverExecuteEmailInstructions: true,
      attachmentPolicy: 'metadata-only',
    };
  }

  isSenderAllowed(senderEmail: string): boolean {
    const security = this.getSecurityConfig();
    const isBlacklisted = security.senderBlacklist.some((pattern) =>
      this.matchesPattern(senderEmail, pattern)
    );
    if (isBlacklisted) return false;
    if (security.senderWhitelist.length === 0) return true;
    return security.senderWhitelist.some((pattern) =>
      this.matchesPattern(senderEmail, pattern)
    );
  }

  isRecipientAllowedForAutoSend(recipientEmail: string): boolean {
    const security = this.getSecurityConfig();
    if (security.sendMode === 'draft-only') return false;
    if (security.sendMode === 'full-access') return true;
    return security.autoSendWhitelist.some((pattern) =>
      this.matchesPattern(recipientEmail, pattern)
    );
  }

  canSend(): { allowed: boolean; reason?: string } {
    const security = this.getSecurityConfig();
    const currentHour = Math.floor(Date.now() / (60 * 60 * 1000));
    const sendCount = this.sendHistory.get(currentHour) || 0;
    if (sendCount >= security.maxSendsPerHour) {
      return {
        allowed: false,
        reason: `Rate limit: ${sendCount}/${security.maxSendsPerHour} emails this hour`,
      };
    }
    return { allowed: true };
  }

  recordSend(): void {
    const currentHour = Math.floor(Date.now() / (60 * 60 * 1000));
    const sendCount = this.sendHistory.get(currentHour) || 0;
    this.sendHistory.set(currentHour, sendCount + 1);
    const oldestHour = currentHour - 24;
    for (const hour of this.sendHistory.keys()) {
      if (hour < oldestHour) this.sendHistory.delete(hour);
    }
  }

  validateSend(recipientEmail: string): {
    allowed: boolean;
    mode: 'draft' | 'send';
    reason?: string;
  } {
    const security = this.getSecurityConfig();
    const rateLimitCheck = this.canSend();
    if (!rateLimitCheck.allowed) {
      return { allowed: false, mode: 'draft', reason: rateLimitCheck.reason };
    }
    if (security.sendMode === 'draft-only') {
      return { allowed: true, mode: 'draft', reason: 'draft-only mode' };
    }
    if (security.sendMode === 'full-access') {
      return { allowed: true, mode: 'send' };
    }
    if (this.isRecipientAllowedForAutoSend(recipientEmail)) {
      return { allowed: true, mode: 'send' };
    }
    return {
      allowed: true,
      mode: 'draft',
      reason: `Recipient ${recipientEmail} not in whitelist`,
    };
  }

  private matchesPattern(email: string, pattern: string): boolean {
    if (email.toLowerCase() === pattern.toLowerCase()) return true;
    if (pattern.startsWith('@')) {
      return email.toLowerCase().endsWith(pattern.toLowerCase());
    }
    const regexPattern = pattern.replace(/[.]/g, '\\.').replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(email);
  }

  logSecurityEvent(event: {
    type: 'blocked' | 'sanitized' | 'rate-limited' | 'warning';
    operation: string;
    details: string;
  }): void {
    const timestamp = new Date().toISOString();
    console.warn(
      `[EMAIL_SECURITY] ${timestamp} ${event.type.toUpperCase()}: ${event.operation} - ${event.details}`
    );
  }
}

export const emailSecurity = new EmailSecurityGuard();
