// Plugin registry management

import fs from 'node:fs/promises';
import path from 'node:path';
import { getPluginDefinition, PLUGIN_DEFINITIONS } from './definitions.js';
import type {
  PluginRegistry,
  InstalledPlugin,
  PluginStatus,
  PluginDefinition,
} from './types.js';
import { PluginRegistrySchema } from './types.js';

/**
 * Plugin manager
 */
export class PluginManager {
  private registryPath: string;
  private registry: PluginRegistry | null = null;

  constructor(workspaceDir: string) {
    this.registryPath = path.join(workspaceDir, 'plugins.json');
  }

  /**
   * Load plugin registry from disk
   */
  async load(): Promise<PluginRegistry> {
    if (this.registry) return this.registry;

    try {
      const data = await fs.readFile(this.registryPath, 'utf-8');
      this.registry = PluginRegistrySchema.parse(JSON.parse(data));
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        // Initialize empty registry
        this.registry = { version: '1.0.0', plugins: {} };
        await this.save();
      } else {
        throw err;
      }
    }

    return this.registry;
  }

  /**
   * Save plugin registry to disk
   */
  async save(): Promise<void> {
    if (!this.registry) {
      throw new Error('Registry not loaded');
    }

    await fs.writeFile(
      this.registryPath,
      JSON.stringify(this.registry, null, 2),
      'utf-8'
    );
  }

  /**
   * List all installed plugins
   */
  async list(): Promise<InstalledPlugin[]> {
    const registry = await this.load();
    return Object.values(registry.plugins);
  }

  /**
   * Get plugin status
   */
  async status(name: string): Promise<PluginStatus | null> {
    const registry = await this.load();
    const installed = registry.plugins[name];
    const definition = getPluginDefinition(name);

    if (!definition) {
      return null;
    }

    const errors: string[] = [];
    let configured = true;

    // Check if all required env vars are set
    if (installed) {
      for (const envVar of definition.envVars) {
        if (envVar.required && !installed.envVars[envVar.name]) {
          configured = false;
          errors.push(`Missing required env var: ${envVar.name}`);
        }
      }
    }

    return {
      name,
      enabled: installed?.enabled ?? false,
      configured,
      installed: !!installed,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Add a plugin to the registry
   */
  async add(
    name: string,
    envVars: Record<string, string> = {}
  ): Promise<InstalledPlugin> {
    const definition = getPluginDefinition(name);
    if (!definition) {
      throw new Error(`Unknown plugin: ${name}`);
    }

    const registry = await this.load();

    // Check if already installed
    if (registry.plugins[name]) {
      throw new Error(`Plugin already installed: ${name}`);
    }

    // Validate required env vars
    for (const envVar of definition.envVars) {
      if (envVar.required && !envVars[envVar.name]) {
        throw new Error(`Missing required env var: ${envVar.name}`);
      }
    }

    const plugin: InstalledPlugin = {
      name,
      enabled: true,
      envVars,
      installedAt: new Date().toISOString(),
    };

    registry.plugins[name] = plugin;
    await this.save();

    return plugin;
  }

  /**
   * Remove a plugin from the registry
   */
  async remove(name: string): Promise<void> {
    const registry = await this.load();

    if (!registry.plugins[name]) {
      throw new Error(`Plugin not installed: ${name}`);
    }

    delete registry.plugins[name];
    await this.save();
  }

  /**
   * Update plugin configuration
   */
  async update(
    name: string,
    updates: Partial<Pick<InstalledPlugin, 'enabled' | 'envVars'>>
  ): Promise<void> {
    const registry = await this.load();
    const plugin = registry.plugins[name];

    if (!plugin) {
      throw new Error(`Plugin not installed: ${name}`);
    }

    if (updates.enabled !== undefined) {
      plugin.enabled = updates.enabled;
    }

    if (updates.envVars !== undefined) {
      plugin.envVars = { ...plugin.envVars, ...updates.envVars };
    }

    plugin.lastUpdated = new Date().toISOString();
    await this.save();
  }

  /**
   * Generate .mcp.json configuration for all enabled plugins
   */
  async generateMcpConfig(): Promise<Record<string, any>> {
    const registry = await this.load();
    const mcpConfig: Record<string, any> = {};

    for (const [name, plugin] of Object.entries(registry.plugins)) {
      if (!plugin.enabled) continue;

      const definition = getPluginDefinition(name);
      if (!definition) continue;

      // Substitute env vars in mcp config
      const config = JSON.parse(JSON.stringify(definition.mcpConfig)) as {
        command: string;
        args: string[];
        env?: Record<string, string>;
      };
      if (config.env) {
        for (const [key, value] of Object.entries(config.env)) {
          if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
            const varName = value.slice(2, -1);
            config.env[key] = plugin.envVars[varName] || value;
          }
        }
      }

      mcpConfig[name] = config;
    }

    return mcpConfig;
  }

  /**
   * Get all available plugin definitions
   */
  getAvailablePlugins(): PluginDefinition[] {
    return Object.values(PLUGIN_DEFINITIONS);
  }
}
