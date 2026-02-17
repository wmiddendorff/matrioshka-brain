// Plugin registry management

import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  PluginRegistry,
  InstalledPlugin,
  PluginStatus,
  Plugin,
} from './types.js';
import { PluginRegistrySchema } from './types.js';
import { pipedrivePlugin } from './pipedrive/index.js';
import { googlePlugin } from './google/index.js';
import { microsoftPlugin } from './microsoft/index.js';

/**
 * Registry of all available native plugins
 */
export const NATIVE_PLUGINS: Record<string, Plugin> = {
  pipedrive: pipedrivePlugin,
  google: googlePlugin,
  microsoft: microsoftPlugin,
};

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
    const plugin = NATIVE_PLUGINS[name];

    if (!plugin) {
      return null;
    }

    try {
      const pluginStatus = await plugin.getStatus();
      
      return {
        name,
        enabled: installed?.enabled ?? false,
        configured: pluginStatus.configured,
        installed: !!installed,
        errors: pluginStatus.lastError ? [pluginStatus.lastError] : undefined,
      };
    } catch (error) {
      return {
        name,
        enabled: installed?.enabled ?? false,
        configured: false,
        installed: !!installed,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Add a plugin to the registry
   */
  async add(
    name: string,
    options?: Record<string, unknown>
  ): Promise<InstalledPlugin> {
    const plugin = NATIVE_PLUGINS[name];
    if (!plugin) {
      throw new Error(`Unknown plugin: ${name}. Available: ${Object.keys(NATIVE_PLUGINS).join(', ')}`);
    }

    const registry = await this.load();

    // Check if already installed
    if (registry.plugins[name]) {
      throw new Error(`Plugin already installed: ${name}`);
    }

    // Run plugin setup
    await plugin.setup(options);

    const installedPlugin: InstalledPlugin = {
      name,
      enabled: true,
      envVars: {}, // Not used for native plugins - they manage their own secrets
      installedAt: new Date().toISOString(),
    };

    registry.plugins[name] = installedPlugin;
    await this.save();

    return installedPlugin;
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
   * Update plugin configuration (enable/disable)
   */
  async update(
    name: string,
    updates: Partial<Pick<InstalledPlugin, 'enabled'>>
  ): Promise<void> {
    const registry = await this.load();
    const installedPlugin = registry.plugins[name];

    if (!installedPlugin) {
      throw new Error(`Plugin not installed: ${name}`);
    }

    if (updates.enabled !== undefined) {
      installedPlugin.enabled = updates.enabled;
    }

    installedPlugin.lastUpdated = new Date().toISOString();
    await this.save();
  }

  /**
   * Get all available native plugins
   */
  getAvailablePlugins(): Plugin[] {
    return Object.values(NATIVE_PLUGINS);
  }
  
  /**
   * Get a specific plugin instance by name
   */
  getPlugin(name: string): Plugin | undefined {
    return NATIVE_PLUGINS[name];
  }
  
  /**
   * Register tools for all enabled plugins
   */
  async registerEnabledPluginTools(): Promise<void> {
    const registry = await this.load();
    const { registerTool } = await import('../tools/index.js');
    
    for (const [name, installedPlugin] of Object.entries(registry.plugins)) {
      if (!installedPlugin.enabled) continue;
      
      const plugin = NATIVE_PLUGINS[name];
      if (!plugin) continue;
      
      // Check if configured
      const configured = await plugin.isConfigured();
      if (!configured) {
        console.warn(`Plugin '${name}' is enabled but not configured. Skipping tool registration.`);
        continue;
      }
      
      // Register plugin's tools
      const tools = plugin.registerTools();
      for (const tool of tools) {
        registerTool(tool);
      }
    }
  }
}
