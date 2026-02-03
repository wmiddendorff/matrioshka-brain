import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigManager } from '../src/config.js';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

describe('ConfigManager', () => {
  const testWorkspace = join(homedir(), '.openclaw-clone-test');
  const testConfigPath = join(testWorkspace, 'config.json');

  beforeEach(() => {
    // Clean up test workspace before each test
    if (existsSync(testWorkspace)) {
      rmSync(testWorkspace, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up test workspace after each test
    if (existsSync(testWorkspace)) {
      rmSync(testWorkspace, { recursive: true, force: true });
    }
  });

  it('should create default config when file does not exist', () => {
    const config = new ConfigManager();
    const cfg = config.get();

    expect(cfg.version).toBe('0.1.0');
    expect(cfg.heartbeat.enabled).toBe(false);
    expect(cfg.telegram.enabled).toBe(false);
    expect(cfg.security.approvalRequired).toBe(true);
  });

  it('should set and get config values', () => {
    const config = new ConfigManager();

    config.set('heartbeat.enabled', true);
    expect(config.get().heartbeat.enabled).toBe(true);

    config.set('heartbeat.interval', 60000);
    expect(config.get().heartbeat.interval).toBe(60000);
  });

  it('should create workspace directories', () => {
    const config = new ConfigManager();
    config.ensureWorkspace();

    const workspace = config.get().workspace;
    expect(existsSync(workspace)).toBe(true);
    expect(existsSync(config.getWorkspacePath('memory'))).toBe(true);
    expect(existsSync(config.getWorkspacePath('agents/default/sessions'))).toBe(true);
  });

  it('should handle nested config paths', () => {
    const config = new ConfigManager();

    config.set('telegram.pairedUsers', [123456, 789012]);
    expect(config.get().telegram.pairedUsers).toEqual([123456, 789012]);
  });
});
