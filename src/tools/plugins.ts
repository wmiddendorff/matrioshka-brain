/**
 * Plugin Management Tools
 *
 * MCP tools for managing external service integrations:
 * - plugins_list: List installed plugins
 * - plugins_add: Add a new plugin
 * - plugins_remove: Remove a plugin
 * - plugins_status: Get plugin status
 * - plugins_available: List available plugin definitions
 * - plugins_generate_config: Generate .mcp.json for installed plugins
 */

import { z } from 'zod';
import path from 'node:path';
import { registerTool } from './index.js';
import { PluginManager } from '../plugins/index.js';
import { ConfigManager } from '../config.js';

// Get workspace directory from config
function getPluginManager(): PluginManager {
  const config = new ConfigManager();
  const workspaceDir = config.getValue('workspaceDir') as string;
  return new PluginManager(workspaceDir);
}

/**
 * List all installed plugins
 */
registerTool({
  name: 'plugins_list',
  description: 'List all installed plugins',
  inputSchema: z.object({}),
  handler: async () => {
    const manager = getPluginManager();
    const plugins = await manager.list();

    return {
      count: plugins.length,
      plugins: plugins.map((p: any) => ({
        name: p.name,
        enabled: p.enabled,
        installedAt: p.installedAt,
        lastUpdated: p.lastUpdated,
        envVarsConfigured: Object.keys(p.envVars).length,
      })),
    };
  },
});

/**
 * Get plugin status
 */
registerTool({
  name: 'plugins_status',
  description: 'Get detailed status for a specific plugin',
  inputSchema: z.object({
    name: z.string().describe('Plugin name'),
  }),
  handler: async (input) => {
    const { name } = input as { name: string };
    const manager = getPluginManager();
    const status = await manager.status(name);

    if (!status) {
      throw new Error(`Plugin not found: ${name}`);
    }

    return status;
  },
});

/**
 * Add a new plugin
 */
registerTool({
  name: 'plugins_add',
  description: 'Add and configure a new plugin',
  inputSchema: z.object({
    name: z.string().describe('Plugin name (e.g., "gmail", "pipedrive")'),
    envVars: z
      .record(z.string())
      .optional()
      .describe('Environment variables (API keys, tokens, etc.)'),
  }),
  handler: async (input) => {
    const { name, envVars = {} } = input as { name: string; envVars?: Record<string, string> };
    const manager = getPluginManager();

    const plugin = await manager.add(name, envVars);

    return {
      success: true,
      plugin: {
        name: plugin.name,
        enabled: plugin.enabled,
        installedAt: plugin.installedAt,
      },
      message: `Plugin '${name}' installed successfully. Update your .mcp.json to enable it.`,
    };
  },
});

/**
 * Remove a plugin
 */
registerTool({
  name: 'plugins_remove',
  description: 'Remove an installed plugin',
  inputSchema: z.object({
    name: z.string().describe('Plugin name'),
  }),
  handler: async (input) => {
    const { name } = input as { name: string };
    const manager = getPluginManager();

    await manager.remove(name);

    return {
      success: true,
      message: `Plugin '${name}' removed successfully.`,
    };
  },
});

/**
 * Update plugin configuration
 */
registerTool({
  name: 'plugins_update',
  description: 'Update plugin configuration (enable/disable, update env vars)',
  inputSchema: z.object({
    name: z.string().describe('Plugin name'),
    enabled: z.boolean().optional().describe('Enable or disable the plugin'),
    envVars: z.record(z.string()).optional().describe('Update environment variables'),
  }),
  handler: async (input) => {
    const { name, enabled, envVars } = input as {
      name: string;
      enabled?: boolean;
      envVars?: Record<string, string>;
    };
    const manager = getPluginManager();

    await manager.update(name, { enabled, envVars });

    return {
      success: true,
      message: `Plugin '${name}' updated successfully.`,
    };
  },
});

/**
 * List available plugin definitions
 */
registerTool({
  name: 'plugins_available',
  description: 'List all available plugin definitions that can be installed',
  inputSchema: z.object({}),
  handler: async () => {
    const manager = getPluginManager();
    const available = manager.getAvailablePlugins();

    return {
      count: available.length,
      plugins: available.map((def: any) => ({
        name: def.name,
        description: def.description,
        package: def.package,
        repo: def.repo,
        envVars: def.envVars.map((v: any) => ({
          name: v.name,
          description: v.description,
          required: v.required,
          defaultValue: v.defaultValue,
        })),
      })),
    };
  },
});

/**
 * Generate .mcp.json configuration for all enabled plugins
 */
registerTool({
  name: 'plugins_generate_config',
  description: 'Generate .mcp.json configuration entries for all enabled plugins',
  inputSchema: z.object({}),
  handler: async () => {
    const manager = getPluginManager();
    const mcpConfig = await manager.generateMcpConfig();

    return {
      mcpServers: mcpConfig,
      message:
        'Add these entries to your .mcp.json mcpServers section to enable the plugins.',
    };
  },
});
