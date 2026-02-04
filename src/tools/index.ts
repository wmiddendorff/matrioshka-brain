/**
 * Matrioshka Brain Tool Registry
 *
 * Central registry for all MCP tools. Tools are grouped by category:
 * - telegram_*  : Telegram messaging
 * - memory_*    : Knowledge persistence
 * - soul_*      : Personality management
 * - heartbeat_* : Autonomous execution
 * - config_*    : Configuration management
 */

import { z } from 'zod';

// Tool definition type
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  handler: (input: unknown) => Promise<unknown>;
}

// Tool registry
const tools = new Map<string, ToolDefinition>();

/**
 * Register a tool
 */
export function registerTool(tool: ToolDefinition): void {
  tools.set(tool.name, tool);
}

/**
 * Get a tool by name
 */
export function getTool(name: string): ToolDefinition | undefined {
  return tools.get(name);
}

/**
 * Get all registered tools
 */
export function getAllTools(): ToolDefinition[] {
  return Array.from(tools.values());
}

/**
 * Get tools by category prefix
 */
export function getToolsByCategory(prefix: string): ToolDefinition[] {
  return Array.from(tools.values()).filter((t) => t.name.startsWith(prefix));
}

/**
 * Execute a tool by name
 */
export async function executeTool(name: string, input: unknown): Promise<unknown> {
  const tool = tools.get(name);
  if (!tool) {
    throw new Error(`Tool not found: ${name}`);
  }

  // Validate input
  const parsed = tool.inputSchema.parse(input);

  // Execute handler
  return tool.handler(parsed);
}

// --------------------------------------------------
// Placeholder tools (will be implemented in later phases)
// --------------------------------------------------

// Config tools (Phase 0)
registerTool({
  name: 'config_get',
  description: 'Get a configuration value',
  inputSchema: z.object({
    path: z.string().optional().describe('Dot-notation path (e.g., "telegram.enabled"). Omit for full config.'),
  }),
  handler: async (input) => {
    const { ConfigManager } = await import('../config.js');
    const config = new ConfigManager();
    const { path } = input as { path?: string };

    if (path) {
      return { value: config.getValue(path) };
    }
    return { config: config.get() };
  },
});

registerTool({
  name: 'config_set',
  description: 'Set a configuration value',
  inputSchema: z.object({
    path: z.string().describe('Dot-notation path (e.g., "telegram.enabled")'),
    value: z.unknown().describe('Value to set'),
  }),
  handler: async (input) => {
    const { ConfigManager } = await import('../config.js');
    const config = new ConfigManager();
    const { path, value } = input as { path: string; value: unknown };

    config.setValue(path, value);
    config.save();

    return { success: true, path, value };
  },
});

// Export tool categories for documentation
export const TOOL_CATEGORIES = {
  config: ['config_get', 'config_set'],
  telegram: ['telegram_poll', 'telegram_send', 'telegram_pair', 'telegram_status'],
  memory: ['memory_add', 'memory_search', 'memory_get', 'memory_stats', 'memory_delete'],
  soul: ['soul_read', 'soul_propose_update'],
  heartbeat: ['heartbeat_status', 'heartbeat_pause', 'heartbeat_resume'],
} as const;

/**
 * Initialize all tools. Call this once before using tools.
 * This registers tools from all modules.
 */
export async function initTools(): Promise<void> {
  // Dynamically import tool modules to register them
  await import('./telegram.js');
  await import('./memory.js');
  await import('./soul.js');
  await import('./heartbeat.js');
}

// Auto-initialize when module is loaded (for MCP server)
// This is safe because it happens after all exports are defined
const _init = initTools().catch((err) => {
  console.error('Failed to initialize tools:', err);
});
