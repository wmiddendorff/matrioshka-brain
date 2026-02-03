/**
 * Mudpuppy v2 - MCP-first autonomous AI agent
 *
 * Main exports for programmatic usage.
 */

export {
  ConfigManager,
  getMudpuppyHome,
  resolvePath,
  initWorkspace,
  isWorkspaceInitialized,
  type MudpuppyConfig,
} from './config.js';

export {
  registerTool,
  getTool,
  getAllTools,
  getToolsByCategory,
  executeTool,
  TOOL_CATEGORIES,
  type ToolDefinition,
} from './tools/index.js';

export { SecretsManager, getSecret, setSecret, type SecretKey } from './secrets.js';

export * from './telegram/index.js';

// === MEMORY EXPORTS ===
export * from './memory/index.js';

// === APPROVAL EXPORTS ===
export * from './approval/index.js';

// === SOUL EXPORTS ===
export * from './soul/index.js';

// === AUDIT EXPORTS ===
export * from './audit/index.js';

// === AUTONOMY EXPORTS ===
export * from './autonomy/index.js';
