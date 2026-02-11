// Plugin type definitions

import { z } from 'zod';

/**
 * Plugin definition schema
 */
export const PluginDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  package: z.string().optional(), // npm package for npx
  repo: z.string().optional(), // git repo URL
  command: z.string(), // command to run (e.g., "npx", "node")
  args: z.array(z.string()), // command arguments
  envVars: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      required: z.boolean().default(true),
      defaultValue: z.string().optional(),
    })
  ),
  mcpConfig: z.object({
    // Template for .mcp.json entry
    command: z.string(),
    args: z.array(z.string()),
    env: z.record(z.string()).optional(),
  }),
});

export type PluginDefinition = z.infer<typeof PluginDefinitionSchema>;

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
