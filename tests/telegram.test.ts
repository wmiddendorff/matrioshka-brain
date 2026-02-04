/**
 * Telegram Module Tests
 *
 * Tests for Telegram types, protocol, secrets, and IPC client.
 * Note: Bot daemon tests require manual testing with actual Telegram bot.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Create test directory before importing modules
const TEST_HOME = join(tmpdir(), `matrioshka-brain-test-telegram-${Date.now()}-${Math.random().toString(36).slice(2)}`);
process.env.MATRIOSHKA_BRAIN_HOME = TEST_HOME;

// Import modules after setting env
import { SecretsManager, getSecret, setSecret } from '../src/secrets.js';
import {
  createRequest,
  createSuccessResponse,
  createErrorResponse,
  parseRequest,
  parseResponse,
  serialize,
} from '../src/telegram/protocol.js';
import type { TelegramMessage, BotStatus } from '../src/telegram/types.js';

describe('Secrets Module', () => {
  beforeEach(() => {
    if (existsSync(TEST_HOME)) {
      rmSync(TEST_HOME, { recursive: true });
    }
    mkdirSync(TEST_HOME, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_HOME)) {
      rmSync(TEST_HOME, { recursive: true });
    }
  });

  describe('SecretsManager', () => {
    it('loads empty secrets when file does not exist', () => {
      const manager = new SecretsManager();
      expect(manager.keys()).toEqual([]);
    });

    it('sets and gets secrets', () => {
      const manager = new SecretsManager();
      manager.set('TELEGRAM_BOT_TOKEN', 'test-token-123');

      expect(manager.get('TELEGRAM_BOT_TOKEN')).toBe('test-token-123');
      expect(manager.has('TELEGRAM_BOT_TOKEN')).toBe(true);
    });

    it('saves secrets to file', () => {
      const manager = new SecretsManager();
      manager.set('TELEGRAM_BOT_TOKEN', 'test-token-456');
      manager.save();

      const content = readFileSync(manager.getSecretsPath(), 'utf-8');
      expect(content).toContain('TELEGRAM_BOT_TOKEN=test-token-456');
    });

    it('loads secrets from existing file', () => {
      const secretsPath = join(TEST_HOME, 'secrets.env');
      writeFileSync(secretsPath, 'TELEGRAM_BOT_TOKEN=existing-token\nOPENAI_API_KEY=sk-test');

      const manager = new SecretsManager();
      expect(manager.get('TELEGRAM_BOT_TOKEN')).toBe('existing-token');
      expect(manager.get('OPENAI_API_KEY')).toBe('sk-test');
    });

    it('handles quoted values', () => {
      const secretsPath = join(TEST_HOME, 'secrets.env');
      writeFileSync(secretsPath, 'KEY1="quoted value"\nKEY2=\'single quoted\'');

      const manager = new SecretsManager();
      expect(manager.get('KEY1')).toBe('quoted value');
      expect(manager.get('KEY2')).toBe('single quoted');
    });

    it('ignores comments and empty lines', () => {
      const secretsPath = join(TEST_HOME, 'secrets.env');
      writeFileSync(secretsPath, '# This is a comment\n\nTOKEN=value\n  # Another comment');

      const manager = new SecretsManager();
      expect(manager.keys()).toEqual(['TOKEN']);
      expect(manager.get('TOKEN')).toBe('value');
    });

    it('deletes secrets', () => {
      const manager = new SecretsManager();
      manager.set('TOKEN', 'value');
      expect(manager.has('TOKEN')).toBe(true);

      const deleted = manager.delete('TOKEN');
      expect(deleted).toBe(true);
      expect(manager.has('TOKEN')).toBe(false);
    });

    it('returns false when deleting non-existent secret', () => {
      const manager = new SecretsManager();
      const deleted = manager.delete('NONEXISTENT');
      expect(deleted).toBe(false);
    });

    it('quotes values with special characters when saving', () => {
      const manager = new SecretsManager();
      manager.set('KEY', 'value with spaces');
      manager.save();

      const content = readFileSync(manager.getSecretsPath(), 'utf-8');
      expect(content).toContain('KEY="value with spaces"');
    });
  });

  describe('getSecret and setSecret helpers', () => {
    it('getSecret returns undefined for missing key', () => {
      expect(getSecret('NONEXISTENT')).toBeUndefined();
    });

    it('setSecret saves and persists', () => {
      setSecret('TEST_KEY', 'test-value');

      // New manager should see the saved value
      const manager = new SecretsManager();
      expect(manager.get('TEST_KEY')).toBe('test-value');
    });
  });
});

describe('IPC Protocol', () => {
  describe('createRequest', () => {
    it('creates a valid request with id and method', () => {
      const req = createRequest('status');

      expect(req.id).toBeDefined();
      expect(req.id.length).toBeGreaterThan(0);
      expect(req.method).toBe('status');
      expect(req.params).toBeUndefined();
    });

    it('includes params when provided', () => {
      const req = createRequest('poll', { unreadOnly: true, limit: 10 });

      expect(req.method).toBe('poll');
      expect(req.params).toEqual({ unreadOnly: true, limit: 10 });
    });
  });

  describe('createSuccessResponse', () => {
    it('creates a success response', () => {
      const resp = createSuccessResponse('req-123', { messages: [] });

      expect(resp.id).toBe('req-123');
      expect(resp.success).toBe(true);
      expect(resp.result).toEqual({ messages: [] });
      expect(resp.error).toBeUndefined();
    });
  });

  describe('createErrorResponse', () => {
    it('creates an error response', () => {
      const resp = createErrorResponse('req-456', 'Something went wrong');

      expect(resp.id).toBe('req-456');
      expect(resp.success).toBe(false);
      expect(resp.error).toBe('Something went wrong');
      expect(resp.result).toBeUndefined();
    });
  });

  describe('parseRequest', () => {
    it('parses valid JSON request', () => {
      const req = parseRequest('{"id":"123","method":"status"}');

      expect(req).not.toBeNull();
      expect(req!.id).toBe('123');
      expect(req!.method).toBe('status');
    });

    it('parses request with params', () => {
      const req = parseRequest('{"id":"123","method":"poll","params":{"limit":5}}');

      expect(req).not.toBeNull();
      expect(req!.params).toEqual({ limit: 5 });
    });

    it('returns null for invalid JSON', () => {
      expect(parseRequest('not json')).toBeNull();
      expect(parseRequest('{invalid}')).toBeNull();
    });

    it('returns null for missing required fields', () => {
      expect(parseRequest('{"id":"123"}')).toBeNull(); // missing method
      expect(parseRequest('{"method":"status"}')).toBeNull(); // missing id
      expect(parseRequest('{}')).toBeNull();
    });
  });

  describe('parseResponse', () => {
    it('parses valid success response', () => {
      const resp = parseResponse('{"id":"123","success":true,"result":{}}');

      expect(resp).not.toBeNull();
      expect(resp!.id).toBe('123');
      expect(resp!.success).toBe(true);
    });

    it('parses valid error response', () => {
      const resp = parseResponse('{"id":"123","success":false,"error":"fail"}');

      expect(resp).not.toBeNull();
      expect(resp!.success).toBe(false);
      expect(resp!.error).toBe('fail');
    });

    it('returns null for invalid JSON', () => {
      expect(parseResponse('not json')).toBeNull();
    });

    it('returns null for missing required fields', () => {
      expect(parseResponse('{"id":"123"}')).toBeNull(); // missing success
      expect(parseResponse('{"success":true}')).toBeNull(); // missing id
    });
  });

  describe('serialize', () => {
    it('serializes request to JSON line', () => {
      const req = createRequest('status');
      const line = serialize(req);

      expect(line.endsWith('\n')).toBe(true);
      expect(JSON.parse(line.trim())).toEqual(req);
    });

    it('serializes response to JSON line', () => {
      const resp = createSuccessResponse('123', { ok: true });
      const line = serialize(resp);

      expect(line.endsWith('\n')).toBe(true);
      expect(JSON.parse(line.trim())).toEqual(resp);
    });
  });
});

describe('Telegram Types', () => {
  it('TelegramMessage type has correct structure', () => {
    const msg: TelegramMessage = {
      id: 'uuid-123',
      userId: 12345,
      username: 'testuser',
      firstName: 'Test',
      text: 'Hello world',
      timestamp: Date.now(),
      read: false,
      telegramMessageId: 456,
      chatId: 12345,
    };

    expect(msg.id).toBe('uuid-123');
    expect(msg.userId).toBe(12345);
    expect(msg.text).toBe('Hello world');
    expect(msg.read).toBe(false);
  });

  it('BotStatus type has correct structure', () => {
    const status: BotStatus = {
      running: true,
      botUsername: 'testbot',
      botName: 'Test Bot',
      startedAt: Date.now(),
      pid: 1234,
      pairedUsers: 5,
      pendingRequests: 2,
      unreadMessages: 10,
    };

    expect(status.running).toBe(true);
    expect(status.botUsername).toBe('testbot');
    expect(status.pairedUsers).toBe(5);
  });

  it('BotStatus handles optional fields', () => {
    const status: BotStatus = {
      running: false,
      pairedUsers: 0,
      pendingRequests: 0,
      unreadMessages: 0,
    };

    expect(status.running).toBe(false);
    expect(status.botUsername).toBeUndefined();
    expect(status.lastError).toBeUndefined();
  });
});
