import { config as loadEnv } from 'dotenv';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Secrets Manager
 *
 * Handles loading and storing secrets from ~/.matrioshka-brain/secrets.env
 *
 * SECURITY: This file is gitignored. Never commit secrets to version control.
 */

export interface Secrets {
  TELEGRAM_BOT_TOKEN?: string;
  OPENAI_API_KEY?: string;
  // Add more secrets as needed
}

export class SecretsManager {
  private secretsPath: string;
  private secrets: Secrets = {};

  constructor() {
    this.secretsPath = join(homedir(), '.matrioshka-brain', 'secrets.env');
    this.load();
  }

  /**
   * Load secrets from secrets.env file
   */
  private load(): void {
    if (!existsSync(this.secretsPath)) {
      // No secrets file exists yet, that's okay
      return;
    }

    try {
      // Load environment variables from secrets file
      const result = loadEnv({ path: this.secretsPath });

      if (result.parsed) {
        this.secrets = result.parsed as Secrets;
      }
    } catch (error) {
      console.warn(`Warning: Failed to load secrets from ${this.secretsPath}:`, error);
    }
  }

  /**
   * Get a secret value
   */
  public get(key: keyof Secrets): string | undefined {
    return this.secrets[key];
  }

  /**
   * Set a secret value
   */
  public set(key: keyof Secrets, value: string): void {
    this.secrets[key] = value;
  }

  /**
   * Save secrets to secrets.env file
   */
  public save(): void {
    const dir = join(homedir(), '.matrioshka-brain');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Format as KEY=value lines
    const lines: string[] = [
      '# MatrioshkaBrain Secrets',
      '# DO NOT COMMIT THIS FILE TO VERSION CONTROL',
      '',
    ];

    for (const [key, value] of Object.entries(this.secrets)) {
      if (value !== undefined) {
        lines.push(`${key}=${value}`);
      }
    }

    try {
      writeFileSync(this.secretsPath, lines.join('\n') + '\n', 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save secrets to ${this.secretsPath}: ${error}`);
    }
  }

  /**
   * Check if a secret exists
   */
  public has(key: keyof Secrets): boolean {
    return this.secrets[key] !== undefined;
  }

  /**
   * Get the path to the secrets file
   */
  public getPath(): string {
    return this.secretsPath;
  }

  /**
   * Check if secrets file exists
   */
  public exists(): boolean {
    return existsSync(this.secretsPath);
  }
}
