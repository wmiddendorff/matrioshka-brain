/**
 * Config Module Tests
 *
 * Tests for configuration management, path resolution, and workspace initialization.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// We need to mock MUDPUPPY_HOME before importing the module
const TEST_HOME = join(tmpdir(), `mudpuppy-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);

// Set env before importing
process.env.MUDPUPPY_HOME = TEST_HOME;

// Now import the module
import {
  getMudpuppyHome,
  resolvePath,
  initWorkspace,
  isWorkspaceInitialized,
  ConfigManager,
  MudpuppyConfig,
} from '../src/config.js';

describe('Config Module', () => {
  beforeEach(() => {
    // Ensure test directory is clean
    if (existsSync(TEST_HOME)) {
      rmSync(TEST_HOME, { recursive: true });
    }
  });

  afterEach(() => {
    // Cleanup test directory
    if (existsSync(TEST_HOME)) {
      rmSync(TEST_HOME, { recursive: true });
    }
  });

  describe('getMudpuppyHome', () => {
    it('returns MUDPUPPY_HOME from environment', () => {
      expect(getMudpuppyHome()).toBe(TEST_HOME);
    });
  });

  describe('resolvePath', () => {
    it('resolves relative path to MUDPUPPY_HOME', () => {
      expect(resolvePath('config.json')).toBe(join(TEST_HOME, 'config.json'));
    });

    it('resolves nested paths', () => {
      expect(resolvePath('workspace/memory')).toBe(join(TEST_HOME, 'workspace/memory'));
    });

    it('handles empty path', () => {
      expect(resolvePath('')).toBe(TEST_HOME);
    });
  });

  describe('initWorkspace', () => {
    it('creates all required directories', () => {
      const result = initWorkspace();

      expect(result.created.length).toBeGreaterThan(0);
      expect(existsSync(TEST_HOME)).toBe(true);
      expect(existsSync(join(TEST_HOME, 'workspace'))).toBe(true);
      expect(existsSync(join(TEST_HOME, 'workspace/memory'))).toBe(true);
      expect(existsSync(join(TEST_HOME, 'data'))).toBe(true);
      expect(existsSync(join(TEST_HOME, 'data/sessions'))).toBe(true);
      expect(existsSync(join(TEST_HOME, 'bot'))).toBe(true);
      expect(existsSync(join(TEST_HOME, 'tools'))).toBe(true);
    });

    it('reports existing directories on second run', () => {
      const first = initWorkspace();
      const second = initWorkspace();

      expect(first.created.length).toBeGreaterThan(0);
      expect(second.existed.length).toBe(first.created.length);
      expect(second.created.length).toBe(0);
    });
  });

  describe('isWorkspaceInitialized', () => {
    it('returns false when config.json does not exist', () => {
      expect(isWorkspaceInitialized()).toBe(false);
    });

    it('returns true when config.json exists', () => {
      mkdirSync(TEST_HOME, { recursive: true });
      writeFileSync(join(TEST_HOME, 'config.json'), '{}');

      expect(isWorkspaceInitialized()).toBe(true);
    });
  });

  describe('ConfigManager', () => {
    describe('constructor and defaults', () => {
      it('loads default config when no file exists', () => {
        const config = new ConfigManager();
        const cfg = config.get();

        expect(cfg.version).toBe('2.0.0');
        expect(cfg.telegram.enabled).toBe(false);
        expect(cfg.telegram.allowGroups).toBe(false);
        expect(cfg.memory.embeddingProvider).toBe('local');
        expect(cfg.memory.embeddingModel).toBe('Xenova/all-MiniLM-L6-v2');
        expect(cfg.memory.hybridWeights.vector).toBe(0.7);
        expect(cfg.memory.hybridWeights.keyword).toBe(0.3);
        expect(cfg.heartbeat.enabled).toBe(false);
        expect(cfg.heartbeat.interval).toBe(1800000);
        expect(cfg.security.auditLog).toBe(true);
      });

      it('returns correct config path', () => {
        const config = new ConfigManager();
        expect(config.getConfigPath()).toBe(join(TEST_HOME, 'config.json'));
      });
    });

    describe('loading from file', () => {
      it('loads config from existing file', () => {
        mkdirSync(TEST_HOME, { recursive: true });
        writeFileSync(
          join(TEST_HOME, 'config.json'),
          JSON.stringify({
            version: '2.0.0',
            telegram: { enabled: true, allowGroups: true },
          })
        );

        const config = new ConfigManager();
        const cfg = config.get();

        expect(cfg.telegram.enabled).toBe(true);
        expect(cfg.telegram.allowGroups).toBe(true);
      });

      it('merges partial config with defaults', () => {
        mkdirSync(TEST_HOME, { recursive: true });
        writeFileSync(
          join(TEST_HOME, 'config.json'),
          JSON.stringify({
            telegram: { enabled: true },
            // Missing: allowGroups, memory, heartbeat, security
          })
        );

        const config = new ConfigManager();
        const cfg = config.get();

        // Loaded value
        expect(cfg.telegram.enabled).toBe(true);
        // Default values filled in
        expect(cfg.telegram.allowGroups).toBe(false);
        expect(cfg.memory.embeddingProvider).toBe('local');
        expect(cfg.heartbeat.interval).toBe(1800000);
      });

      it('handles nested partial config (hybridWeights)', () => {
        mkdirSync(TEST_HOME, { recursive: true });
        writeFileSync(
          join(TEST_HOME, 'config.json'),
          JSON.stringify({
            memory: {
              hybridWeights: { vector: 0.9 },
              // Missing: keyword
            },
          })
        );

        const config = new ConfigManager();
        const cfg = config.get();

        expect(cfg.memory.hybridWeights.vector).toBe(0.9);
        expect(cfg.memory.hybridWeights.keyword).toBe(0.3); // default
      });

      it('uses defaults on invalid JSON', () => {
        mkdirSync(TEST_HOME, { recursive: true });
        writeFileSync(join(TEST_HOME, 'config.json'), 'not valid json {{{');

        // Suppress console.error for this test
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const config = new ConfigManager();
        const cfg = config.get();

        expect(cfg.version).toBe('2.0.0');
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });
    });

    describe('getValue', () => {
      it('gets top-level values', () => {
        const config = new ConfigManager();

        expect(config.getValue<string>('version')).toBe('2.0.0');
      });

      it('gets nested values with dot notation', () => {
        const config = new ConfigManager();

        expect(config.getValue<boolean>('telegram.enabled')).toBe(false);
        expect(config.getValue<number>('heartbeat.interval')).toBe(1800000);
        expect(config.getValue<number>('memory.hybridWeights.vector')).toBe(0.7);
      });

      it('returns undefined for non-existent paths', () => {
        const config = new ConfigManager();

        expect(config.getValue('nonexistent')).toBeUndefined();
        expect(config.getValue('telegram.nonexistent')).toBeUndefined();
        expect(config.getValue('a.b.c.d.e')).toBeUndefined();
      });

      it('gets array values', () => {
        const config = new ConfigManager();
        const approvalRequired = config.getValue<string[]>('security.approvalRequired');

        expect(Array.isArray(approvalRequired)).toBe(true);
        expect(approvalRequired).toContain('soul_propose_update');
        expect(approvalRequired).toContain('telegram_pair');
      });
    });

    describe('setValue', () => {
      it('sets top-level values', () => {
        const config = new ConfigManager();

        config.setValue('version', '3.0.0');
        expect(config.getValue('version')).toBe('3.0.0');
      });

      it('sets nested values with dot notation', () => {
        const config = new ConfigManager();

        config.setValue('telegram.enabled', true);
        expect(config.getValue('telegram.enabled')).toBe(true);

        config.setValue('heartbeat.interval', 60000);
        expect(config.getValue('heartbeat.interval')).toBe(60000);
      });

      it('sets deeply nested values', () => {
        const config = new ConfigManager();

        config.setValue('memory.hybridWeights.vector', 0.8);
        expect(config.getValue('memory.hybridWeights.vector')).toBe(0.8);
        // Other values unchanged
        expect(config.getValue('memory.hybridWeights.keyword')).toBe(0.3);
      });

      it('creates intermediate objects if missing', () => {
        const config = new ConfigManager();

        config.setValue('newSection.newKey', 'newValue');
        expect(config.getValue('newSection.newKey')).toBe('newValue');
      });

      it('sets object values', () => {
        const config = new ConfigManager();

        config.setValue('heartbeat.activeHours', {
          start: '09:00',
          end: '17:00',
          timezone: 'America/Los_Angeles',
        });

        const activeHours = config.getValue<{ start: string; end: string; timezone: string }>(
          'heartbeat.activeHours'
        );
        expect(activeHours?.start).toBe('09:00');
        expect(activeHours?.end).toBe('17:00');
        expect(activeHours?.timezone).toBe('America/Los_Angeles');
      });

      it('sets array values', () => {
        const config = new ConfigManager();

        config.setValue('security.approvalRequired', ['tool_a', 'tool_b']);
        const arr = config.getValue<string[]>('security.approvalRequired');

        expect(arr).toEqual(['tool_a', 'tool_b']);
      });

      it('handles empty path gracefully', () => {
        const config = new ConfigManager();
        const original = config.get();

        config.setValue('', 'value');
        // Should not crash, config unchanged
        expect(config.get()).toEqual(original);
      });
    });

    describe('save', () => {
      it('saves config to file', () => {
        const config = new ConfigManager();
        config.setValue('telegram.enabled', true);
        config.save();

        expect(existsSync(join(TEST_HOME, 'config.json'))).toBe(true);

        const saved = JSON.parse(readFileSync(join(TEST_HOME, 'config.json'), 'utf-8'));
        expect(saved.telegram.enabled).toBe(true);
      });

      it('creates directory if it does not exist', () => {
        expect(existsSync(TEST_HOME)).toBe(false);

        const config = new ConfigManager();
        config.save();

        expect(existsSync(TEST_HOME)).toBe(true);
        expect(existsSync(join(TEST_HOME, 'config.json'))).toBe(true);
      });

      it('pretty-prints JSON with 2-space indent', () => {
        const config = new ConfigManager();
        config.save();

        const content = readFileSync(join(TEST_HOME, 'config.json'), 'utf-8');
        // Check for indentation
        expect(content).toContain('  "version"');
        expect(content).toContain('  "telegram"');
      });

      it('persists changes across instances', () => {
        const config1 = new ConfigManager();
        config1.setValue('telegram.enabled', true);
        config1.setValue('heartbeat.interval', 60000);
        config1.save();

        const config2 = new ConfigManager();
        expect(config2.getValue('telegram.enabled')).toBe(true);
        expect(config2.getValue('heartbeat.interval')).toBe(60000);
      });
    });

    describe('reset', () => {
      it('resets config to defaults', () => {
        const config = new ConfigManager();

        config.setValue('telegram.enabled', true);
        config.setValue('heartbeat.interval', 60000);
        expect(config.getValue('telegram.enabled')).toBe(true);

        config.reset();

        expect(config.getValue('telegram.enabled')).toBe(false);
        expect(config.getValue('heartbeat.interval')).toBe(1800000);
      });

      it('does not affect saved file until save() is called', () => {
        const config = new ConfigManager();
        config.setValue('telegram.enabled', true);
        config.save();

        config.reset();
        // File still has old value
        const saved = JSON.parse(readFileSync(join(TEST_HOME, 'config.json'), 'utf-8'));
        expect(saved.telegram.enabled).toBe(true);

        // After save, file has reset values
        config.save();
        const savedAfter = JSON.parse(readFileSync(join(TEST_HOME, 'config.json'), 'utf-8'));
        expect(savedAfter.telegram.enabled).toBe(false);
      });
    });

    describe('get', () => {
      it('returns full config object', () => {
        const config = new ConfigManager();
        const cfg = config.get();

        expect(cfg).toHaveProperty('version');
        expect(cfg).toHaveProperty('telegram');
        expect(cfg).toHaveProperty('memory');
        expect(cfg).toHaveProperty('heartbeat');
        expect(cfg).toHaveProperty('security');
      });

      it('returns live reference (modifications affect config)', () => {
        const config = new ConfigManager();
        const cfg = config.get();

        cfg.telegram.enabled = true;
        expect(config.getValue('telegram.enabled')).toBe(true);
      });
    });
  });
});
