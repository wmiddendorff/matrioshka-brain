import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SecretsManager } from '../src/secrets.js';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

describe('SecretsManager', () => {
  const testWorkspace = join(homedir(), '.openclaw-clone-test-secrets');
  const testSecretsPath = join(testWorkspace, 'secrets.env');

  beforeEach(() => {
    // Clean up test workspace
    if (existsSync(testWorkspace)) {
      rmSync(testWorkspace, { recursive: true, force: true });
    }
    mkdirSync(testWorkspace, { recursive: true });

    // Create a custom secrets manager pointing to test location
    // Note: We'll need to modify SecretsManager to accept custom path for testing
  });

  afterEach(() => {
    // Clean up
    if (existsSync(testWorkspace)) {
      rmSync(testWorkspace, { recursive: true, force: true });
    }
  });

  it('should create secrets manager without existing file', () => {
    const secrets = new SecretsManager();
    expect(secrets.has('TELEGRAM_BOT_TOKEN')).toBe(false);
  });

  it('should set and get secret values', () => {
    const secrets = new SecretsManager();

    secrets.set('TELEGRAM_BOT_TOKEN', 'test-token-123');
    expect(secrets.get('TELEGRAM_BOT_TOKEN')).toBe('test-token-123');
    expect(secrets.has('TELEGRAM_BOT_TOKEN')).toBe(true);
  });

  it('should save and load secrets from file', () => {
    const secrets1 = new SecretsManager();
    secrets1.set('TELEGRAM_BOT_TOKEN', 'my-secret-token');
    secrets1.save();

    // Create new instance to test loading
    const secrets2 = new SecretsManager();
    expect(secrets2.get('TELEGRAM_BOT_TOKEN')).toBe('my-secret-token');
  });

  it('should return undefined for non-existent secrets', () => {
    const secrets = new SecretsManager();
    expect(secrets.get('OPENAI_API_KEY')).toBeUndefined();
  });
});
