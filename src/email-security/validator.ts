// Email security validator

import type {
  EmailSecurityConfig,
  EmailValidationResult,
  SendValidationResult,
  SecurityEvent,
} from './types.js';
import { ConfigManager } from '../config.js';

/**
 * Email security validator
 */
export class EmailSecurityValidator {
  private config: EmailSecurityConfig;
  private sendCount: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(config?: EmailSecurityConfig) {
    const configManager = new ConfigManager();
    this.config = config || (configManager.getValue('email.security') as EmailSecurityConfig) || {
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

  /**
   * Validate if sender is allowed
   */
  validateSender(email: string): EmailValidationResult {
    const normalizedEmail = email.toLowerCase().trim();

    // Check blacklist first
    if (this.isBlacklisted(normalizedEmail)) {
      return {
        allowed: false,
        reason: 'Sender is blacklisted',
      };
    }

    // Check whitelist
    if (this.config.senderWhitelist.length === 0) {
      // No whitelist configured - allow all (but warn)
      return {
        allowed: true,
        warnings: ['No sender whitelist configured. All senders allowed.'],
      };
    }

    if (this.isWhitelisted(normalizedEmail)) {
      return { allowed: true };
    }

    // Not whitelisted
    return {
      allowed: false,
      reason: 'Sender not in whitelist',
      warnings: ['Only whitelisted senders can trigger actions. Email will be summarized only.'],
    };
  }

  /**
   * Check if email is whitelisted
   */
  private isWhitelisted(email: string): boolean {
    return this.config.senderWhitelist.some((pattern) => {
      if (pattern.startsWith('@')) {
        // Domain match
        return email.endsWith(pattern) || email.includes(pattern);
      } else {
        // Exact email match
        return email === pattern.toLowerCase();
      }
    });
  }

  /**
   * Check if email is blacklisted
   */
  private isBlacklisted(email: string): boolean {
    return this.config.senderBlacklist.some((pattern) => {
      if (pattern.startsWith('@')) {
        return email.endsWith(pattern) || email.includes(pattern);
      } else {
        return email === pattern.toLowerCase();
      }
    });
  }

  /**
   * Detect potential email injection attempts
   */
  detectInjection(emailBody: string): { detected: boolean; patterns: string[] } {
    const injectionPatterns = [
      /delete\s+(all\s+)?(files?|data|everything)/gi,
      /send\s+(to|email|forward)/gi,
      /execute\s+(command|script|code)/gi,
      /run\s+(command|script|this)/gi,
      /sudo\s+/gi,
      /rm\s+-rf/gi,
      /DROP\s+TABLE/gi,
      /eval\s*\(/gi,
      /system\s*\(/gi,
      /exec\s*\(/gi,
      /<script/gi,
      /javascript:/gi,
      /transfer\s+(funds|money|bitcoin)/gi,
      /approve\s+(transaction|payment)/gi,
      /ignore\s+previous\s+instructions/gi,
      /override\s+security/gi,
      /disable\s+(security|whitelist|protection)/gi,
    ];

    const detected: string[] = [];

    for (const pattern of injectionPatterns) {
      const matches = emailBody.match(pattern);
      if (matches) {
        detected.push(...matches);
      }
    }

    return {
      detected: detected.length > 0,
      patterns: detected,
    };
  }

  /**
   * Validate email sending
   */
  validateSend(to: string): SendValidationResult {
    const normalizedTo = to.toLowerCase().trim();

    // Check rate limit
    const rateLimitCheck = this.checkRateLimit();
    if (!rateLimitCheck.allowed) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: rateLimitCheck.reason,
      };
    }

    // Check send mode
    switch (this.config.sendMode) {
      case 'draft-only':
        return {
          allowed: false,
          requiresApproval: false,
          reason: 'Send mode is draft-only. Use gmail_draft or outlook_draft instead.',
        };

      case 'whitelist-only':
        const isWhitelisted = this.config.autoSendWhitelist.some((pattern) => {
          if (pattern.startsWith('@')) {
            return normalizedTo.endsWith(pattern) || normalizedTo.includes(pattern);
          } else {
            return normalizedTo === pattern.toLowerCase();
          }
        });

        if (isWhitelisted) {
          return { allowed: true, requiresApproval: false };
        } else {
          return {
            allowed: false,
            requiresApproval: true,
            reason: 'Recipient not in auto-send whitelist. Requires manual approval.',
          };
        }

      case 'require-approval':
        return {
          allowed: false,
          requiresApproval: true,
          reason: 'All sends require manual approval in current mode.',
        };

      default:
        return {
          allowed: false,
          requiresApproval: false,
          reason: 'Unknown send mode',
        };
    }
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(): { allowed: boolean; reason?: string } {
    const now = Date.now();
    const hourKey = Math.floor(now / (60 * 60 * 1000)).toString();
    
    const current = this.sendCount.get(hourKey) || { count: 0, resetTime: now + 60 * 60 * 1000 };

    // Clean up old entries
    if (now > current.resetTime) {
      this.sendCount.clear();
      return { allowed: true };
    }

    if (current.count >= this.config.maxSendsPerHour) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${this.config.maxSendsPerHour} sends per hour`,
      };
    }

    return { allowed: true };
  }

  /**
   * Record a sent email (for rate limiting)
   */
  recordSend(): void {
    const now = Date.now();
    const hourKey = Math.floor(now / (60 * 60 * 1000)).toString();
    
    const current = this.sendCount.get(hourKey) || { count: 0, resetTime: now + 60 * 60 * 1000 };
    current.count++;
    this.sendCount.set(hourKey, current);
  }

  /**
   * Log security event to audit log
   */
  logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    // Log to console (in production, this would go to audit.log)
    console.warn('[EMAIL SECURITY]', fullEvent.type.toUpperCase(), fullEvent);

    // TODO: Write to audit.log file
  }

  /**
   * Get current configuration
   */
  getConfig(): EmailSecurityConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<EmailSecurityConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// Singleton instance
export const emailSecurity = new EmailSecurityValidator();
