// Base plugin class

import type { Plugin, PluginAuthType } from './types.js';
import type { ToolDefinition } from '../tools/index.js';
import { SecretsManager } from '../secrets.js';

/**
 * Abstract base class for plugins
 */
export abstract class BasePlugin implements Plugin {
  abstract name: string;
  abstract description: string;
  abstract authType: PluginAuthType;
  
  protected secrets: SecretsManager;
  
  constructor() {
    this.secrets = new SecretsManager();
  }
  
  /**
   * Get a secret value
   */
  protected getSecret(key: string): string | undefined {
    return this.secrets.get(key);
  }
  
  /**
   * Set a secret value
   */
  protected setSecret(key: string, value: string): void {
    this.secrets.set(key, value);
    this.secrets.save();
  }
  
  /**
   * Check if all required secrets are set
   */
  protected hasSecrets(...keys: string[]): boolean {
    return keys.every(key => !!this.getSecret(key));
  }
  
  abstract isConfigured(): Promise<boolean>;
  abstract setup(options?: Record<string, unknown>): Promise<void>;
  abstract registerTools(): ToolDefinition[];
  abstract getStatus(): Promise<{
    configured: boolean;
    authenticated: boolean;
    lastError?: string;
  }>;
}
