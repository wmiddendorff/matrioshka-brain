// Plugin type definitions

import { z } from 'zod';
import type { ToolDefinition } from '../tools/index.js';

/**
 * Plugin authentication type
 */
export type PluginAuthType = 'oauth2' | 'api-key' | 'device-code';

/**
 * Plugin definition schema
 */
export const PluginDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  authType: z.enum(['oauth2', 'api-key', 'device-code']),
  secretKeys: z.array(z.string()).describe('Keys stored in secrets.env'),
  configKeys: z.array(z.string()).optional().describe('Keys stored in config (non-sensitive)'),
  tools: z.array(z.string()).describe('MCP tool names this plugin registers'),
});

export type PluginDefinition = z.infer<typeof PluginDefinitionSchema>;

/**
 * Plugin interface - all plugins must implement this
 */
export interface Plugin {
  /** Plugin name (e.g., "pipedrive", "google") */
  name: string;
  
  /** Plugin description */
  description: string;
  
  /** Authentication type */
  authType: PluginAuthType;
  
  /** Check if plugin is configured (has required secrets) */
  isConfigured(): Promise<boolean>;
  
  /** Set up the plugin (interactive or programmatic) */
  setup(options?: Record<string, unknown>): Promise<void>;
  
  /** Register MCP tools with the tool registry */
  registerTools(): ToolDefinition[];
  
  /** Get plugin status */
  getStatus(): Promise<{
    configured: boolean;
    authenticated: boolean;
    lastError?: string;
  }>;
}

/**
 * Installed plugin schema (adds user configuration)
 */
export const InstalledPluginSchema = z.object({
  name: z.string(),
  enabled: z.boolean().default(true),
  envVars: z.record(z.string()), // user-provided env var values
  installedAt: z.string(),
  lastUpdated: z.string().optional(),
});

export type InstalledPlugin = z.infer<typeof InstalledPluginSchema>;

/**
 * Plugin registry schema (stored in ~/.matrioshka-brain/plugins.json)
 */
export const PluginRegistrySchema = z.object({
  version: z.string().default('1.0.0'),
  plugins: z.record(InstalledPluginSchema),
});

export type PluginRegistry = z.infer<typeof PluginRegistrySchema>;

/**
 * Plugin status
 */
export interface PluginStatus {
  name: string;
  enabled: boolean;
  configured: boolean; // all required env vars set
  installed: boolean;
  errors?: string[];
}
