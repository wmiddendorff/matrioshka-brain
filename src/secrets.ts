/**
 * Matrioshka Brain Secrets Manager
 *
 * Handles loading and saving secrets from ~/.matrioshka-brain/secrets.env
 * Secrets are stored in dotenv format and never committed to git.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { resolvePath } from './config.js';

const SECRETS_FILE = 'secrets.env';

/**
 * Known secret keys used by Matrioshka Brain
 */
export type SecretKey = 'TELEGRAM_BOT_TOKEN' | 'OPENAI_API_KEY' | string;

/**
 * Parse a dotenv file into a key-value object
 */
function parseDotenv(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of content.split('\n')) {
    // Skip empty lines and comments
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Parse KEY=value
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

/**
 * Serialize a key-value object to dotenv format
 */
function serializeDotenv(secrets: Record<string, string>): string {
  const lines: string[] = [
    '# Matrioshka Brain Secrets',
    '# This file is gitignored and contains sensitive credentials',
    '',
  ];

  for (const [key, value] of Object.entries(secrets)) {
    // Quote values that contain spaces or special characters
    if (value.includes(' ') || value.includes('#') || value.includes('=')) {
      lines.push(`${key}="${value}"`);
    } else {
      lines.push(`${key}=${value}`);
    }
  }

  lines.push(''); // trailing newline
  return lines.join('\n');
}

export class SecretsManager {
  private secretsPath: string;
  private secrets: Record<string, string>;

  constructor() {
    this.secretsPath = resolvePath(SECRETS_FILE);
    this.secrets = this.load();
  }

  /**
   * Load secrets from file
   */
  private load(): Record<string, string> {
    if (!existsSync(this.secretsPath)) {
      return {};
    }

    try {
      const content = readFileSync(this.secretsPath, 'utf-8');
      return parseDotenv(content);
    } catch (error) {
      console.error(`Error loading secrets: ${error}`);
      return {};
    }
  }

  /**
   * Save secrets to file
   */
  save(): void {
    const dir = dirname(this.secretsPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(this.secretsPath, serializeDotenv(this.secrets), {
      mode: 0o600, // Read/write only for owner
    });
  }

  /**
   * Get a secret value
   */
  get(key: SecretKey): string | undefined {
    return this.secrets[key];
  }

  /**
   * Set a secret value
   */
  set(key: SecretKey, value: string): void {
    this.secrets[key] = value;
  }

  /**
   * Delete a secret
   */
  delete(key: SecretKey): boolean {
    if (key in this.secrets) {
      delete this.secrets[key];
      return true;
    }
    return false;
  }

  /**
   * Check if a secret exists
   */
  has(key: SecretKey): boolean {
    return key in this.secrets;
  }

  /**
   * Get all secret keys (not values)
   */
  keys(): string[] {
    return Object.keys(this.secrets);
  }

  /**
   * Get the secrets file path
   */
  getSecretsPath(): string {
    return this.secretsPath;
  }
}

/**
 * Get a secret value without creating a manager instance
 */
export function getSecret(key: SecretKey): string | undefined {
  const manager = new SecretsManager();
  return manager.get(key);
}

/**
 * Set a secret value and save to file
 */
export function setSecret(key: SecretKey, value: string): void {
  const manager = new SecretsManager();
  manager.set(key, value);
  manager.save();
}
