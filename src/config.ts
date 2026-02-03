import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface Config {
  version: string;
  workspace: string;
  heartbeat: {
    enabled: boolean;
    interval: number; // milliseconds
    activeHours?: {
      start: string; // "09:00"
      end: string; // "23:00"
      timezone: string; // "America/Los_Angeles"
    };
    requireApproval: boolean;
    maxActionsPerBeat: number;
  };
  telegram: {
    enabled: boolean;
    botToken?: string;
    pairedUsers: number[];
    enableGroups: boolean;
    notifyHeartbeat: boolean;
  };
  memory: {
    enabled: boolean;
    embeddingProvider: 'openai' | 'local';
    searchMode: 'hybrid' | 'vector' | 'keyword';
  };
  security: {
    approvalRequired: boolean;
    auditLog: boolean;
    sandboxMode: 'off' | 'non-main' | 'all';
  };
}

const DEFAULT_CONFIG: Config = {
  version: '0.1.0',
  workspace: join(homedir(), '.mudpuppy'),
  heartbeat: {
    enabled: false,
    interval: 1800000, // 30 minutes
    requireApproval: true,
    maxActionsPerBeat: 10,
  },
  telegram: {
    enabled: false,
    pairedUsers: [],
    enableGroups: false,
    notifyHeartbeat: true,
  },
  memory: {
    enabled: false,
    embeddingProvider: 'local',
    searchMode: 'hybrid',
  },
  security: {
    approvalRequired: true,
    auditLog: true,
    sandboxMode: 'off',
  },
};

export class ConfigManager {
  private config: Config;
  private configPath: string;

  constructor() {
    this.configPath = join(homedir(), '.mudpuppy', 'config.json');
    this.config = this.load();
  }

  private load(): Config {
    if (!existsSync(this.configPath)) {
      return DEFAULT_CONFIG;
    }

    try {
      const data = readFileSync(this.configPath, 'utf-8');
      const loaded = JSON.parse(data);
      // Merge with defaults to handle missing fields
      return { ...DEFAULT_CONFIG, ...loaded };
    } catch (error) {
      console.warn(`Failed to load config from ${this.configPath}, using defaults:`, error);
      return DEFAULT_CONFIG;
    }
  }

  public save(): void {
    const dir = join(homedir(), '.openclaw-clone');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    try {
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save config to ${this.configPath}: ${error}`);
    }
  }

  public get(): Config {
    return this.config;
  }

  public set(key: string, value: any): void {
    const keys = key.split('.');
    let current: any = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
  }

  public getWorkspacePath(...paths: string[]): string {
    return join(this.config.workspace, ...paths);
  }

  public ensureWorkspace(): void {
    if (!existsSync(this.config.workspace)) {
      mkdirSync(this.config.workspace, { recursive: true });
    }

    // Create standard directories
    const dirs = ['memory', 'agents/default/sessions'];
    for (const dir of dirs) {
      const path = this.getWorkspacePath(dir);
      if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
      }
    }
  }
}
