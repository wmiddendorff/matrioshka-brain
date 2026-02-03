/**
 * Mudpuppy Configuration Manager
 *
 * Handles configuration loading/saving with portable path resolution.
 * All paths use $MUDPUPPY_HOME or default to ~/.mudpuppy
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Get MUDPUPPY_HOME from environment or default to ~/.mudpuppy
export function getMudpuppyHome(): string {
  return process.env.MUDPUPPY_HOME || join(homedir(), '.mudpuppy');
}

// Resolve a path relative to MUDPUPPY_HOME
export function resolvePath(relativePath: string): string {
  return join(getMudpuppyHome(), relativePath);
}

// Default configuration
export interface MudpuppyConfig {
  version: string;
  telegram: {
    enabled: boolean;
    allowGroups: boolean;
  };
  memory: {
    embeddingProvider: 'local' | 'openai' | 'none';
    embeddingModel: string;
    hybridWeights: {
      vector: number;
      keyword: number;
    };
    autoIndex: boolean;
    indexInterval: number;
  };
  heartbeat: {
    enabled: boolean;
    interval: number;
    activeHours?: {
      start: string;
      end: string;
      timezone: string;
    };
    maxActionsPerBeat: number;
    requireApproval: boolean;
  };
  security: {
    approvalRequired: string[];
    auditLog: boolean;
    maxMessageLength: number;
  };
}

const DEFAULT_CONFIG: MudpuppyConfig = {
  version: '2.0.0',
  telegram: {
    enabled: false,
    allowGroups: false,
  },
  memory: {
    embeddingProvider: 'local',
    embeddingModel: 'Xenova/all-MiniLM-L6-v2',
    hybridWeights: {
      vector: 0.7,
      keyword: 0.3,
    },
    autoIndex: true,
    indexInterval: 5000,
  },
  heartbeat: {
    enabled: false,
    interval: 1800000, // 30 minutes
    maxActionsPerBeat: 5,
    requireApproval: true,
  },
  security: {
    approvalRequired: ['soul_propose_update', 'telegram_pair'],
    auditLog: true,
    maxMessageLength: 4096,
  },
};

export class ConfigManager {
  private config: MudpuppyConfig;
  private configPath: string;

  constructor() {
    this.configPath = resolvePath('config.json');
    this.config = this.load();
  }

  /**
   * Load configuration from file or create default
   */
  private load(): MudpuppyConfig {
    if (existsSync(this.configPath)) {
      try {
        const content = readFileSync(this.configPath, 'utf-8');
        const loaded = JSON.parse(content);
        // Merge with defaults to ensure all fields exist
        return this.mergeWithDefaults(loaded);
      } catch (error) {
        console.error(`Error loading config: ${error}`);
        return { ...DEFAULT_CONFIG };
      }
    }
    return { ...DEFAULT_CONFIG };
  }

  /**
   * Merge loaded config with defaults (handles missing fields)
   */
  private mergeWithDefaults(loaded: Partial<MudpuppyConfig>): MudpuppyConfig {
    return {
      ...DEFAULT_CONFIG,
      ...loaded,
      telegram: { ...DEFAULT_CONFIG.telegram, ...loaded.telegram },
      memory: {
        ...DEFAULT_CONFIG.memory,
        ...loaded.memory,
        hybridWeights: {
          ...DEFAULT_CONFIG.memory.hybridWeights,
          ...loaded.memory?.hybridWeights,
        },
      },
      heartbeat: { ...DEFAULT_CONFIG.heartbeat, ...loaded.heartbeat },
      security: { ...DEFAULT_CONFIG.security, ...loaded.security },
    };
  }

  /**
   * Save configuration to file
   */
  save(): void {
    const dir = getMudpuppyHome();
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  /**
   * Get the full configuration
   */
  get(): MudpuppyConfig {
    return this.config;
  }

  /**
   * Get a specific config value by dot-notation path
   */
  getValue<T>(path: string): T | undefined {
    const parts = path.split('.');
    let current: unknown = this.config;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current as T;
  }

  /**
   * Set a specific config value by dot-notation path
   */
  setValue(path: string, value: unknown): void {
    const parts = path.split('.');
    const lastPart = parts.pop();
    if (!lastPart) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = this.config;

    for (const part of parts) {
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }

    current[lastPart] = value;
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Get the config file path
   */
  getConfigPath(): string {
    return this.configPath;
  }
}

/**
 * Initialize workspace directory structure
 */
export function initWorkspace(): { created: string[]; existed: string[] } {
  const home = getMudpuppyHome();
  const dirs = [
    '',                    // root
    'workspace',           // soul/identity files
    'workspace/memory',    // daily logs
    'data',                // database, sessions
    'data/sessions',       // session transcripts
    'bot',                 // telegram bot daemon
    'tools',               // tool documentation
  ];

  const created: string[] = [];
  const existed: string[] = [];

  for (const dir of dirs) {
    const path = join(home, dir);
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
      created.push(path);
    } else {
      existed.push(path);
    }
  }

  return { created, existed };
}

/**
 * Check if workspace is initialized
 */
export function isWorkspaceInitialized(): boolean {
  return existsSync(resolvePath('config.json'));
}
