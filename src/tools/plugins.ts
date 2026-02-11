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

    // Get status for each plugin
    const pluginsWithStatus = await Promise.all(
      plugins.map(async (p: any) => {
        const status = await manager.status(p.name);
        return {
          name: p.name,
          enabled: p.enabled,
          configured: status?.configured ?? false,
          installedAt: p.installedAt,
          lastUpdated: p.lastUpdated,
        };
      })
    );

    return {
      count: plugins.length,
      plugins: pluginsWithStatus,
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
    name: z.string().describe('Plugin name (e.g., "google", "pipedrive", "microsoft")'),
    options: z
      .record(z.unknown())
      .optional()
      .describe('Plugin-specific configuration options'),
  }),
  handler: async (input) => {
    const { name, options } = input as { name: string; options?: Record<string, unknown> };
    const manager = getPluginManager();

    const plugin = await manager.add(name, options);

    // Register the plugin's tools
    await manager.registerEnabledPluginTools();

    return {
      success: true,
      plugin: {
        name: plugin.name,
        enabled: plugin.enabled,
        installedAt: plugin.installedAt,
      },
      message: `Plugin '${name}' installed and tools registered successfully.`,
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
  description: 'Update plugin configuration (enable/disable)',
  inputSchema: z.object({
    name: z.string().describe('Plugin name'),
    enabled: z.boolean().optional().describe('Enable or disable the plugin'),
  }),
  handler: async (input) => {
    const { name, enabled } = input as {
      name: string;
      enabled?: boolean;
    };
    const manager = getPluginManager();

    await manager.update(name, { enabled });

    // Re-register tools if enabling
    if (enabled) {
      await manager.registerEnabledPluginTools();
    }

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
 * Re-configure a plugin (re-run setup)
 */
registerTool({
  name: 'plugins_reconfigure',
  description: 'Re-run setup for an installed plugin to update credentials',
  inputSchema: z.object({
    name: z.string().describe('Plugin name'),
    options: z.record(z.unknown()).optional().describe('Configuration options'),
  }),
  handler: async (input) => {
    const { name, options } = input as { name: string; options?: Record<string, unknown> };
    const manager = getPluginManager();

    const plugin = manager.getPlugin(name);
    if (!plugin) {
      throw new Error(`Unknown plugin: ${name}`);
    }

    await plugin.setup(options);

    return {
      success: true,
      message: `Plugin '${name}' reconfigured successfully.`,
    };
  },
});
