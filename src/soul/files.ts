/**
 * Soul File Operations
 *
 * Read and write soul/identity files. Always reads from disk
 * so manual edits are instantly respected (no caching).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { resolvePath } from '../config.js';
import type { SoulFileType, SoulReadResult } from './types.js';
import { SOUL_FILE_MAP } from './types.js';
import { getDefaultTemplate } from './templates.js';

/**
 * Get the full filesystem path for a soul file.
 */
export function getSoulFilePath(file: SoulFileType): string {
  return resolvePath(join('workspace', SOUL_FILE_MAP[file]));
}

/**
 * Read a soul file from disk. If missing, creates it from the default template.
 * Always reads fresh from disk - no caching.
 */
export function readSoulFile(file: SoulFileType): SoulReadResult {
  const filePath = getSoulFilePath(file);

  // Create from template if missing
  if (!existsSync(filePath)) {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const template = getDefaultTemplate(file);
    writeFileSync(filePath, template);
  }

  const content = readFileSync(filePath, 'utf-8');
  const stat = statSync(filePath);

  return {
    file,
    content,
    lastModified: stat.mtimeMs,
  };
}

/**
 * Write content to a soul file.
 */
export function writeSoulFile(file: SoulFileType, content: string): void {
  const filePath = getSoulFilePath(file);
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, content);
}

/**
 * Ensure all four bootstrap files exist. Creates any missing files
 * from their default templates.
 */
export function ensureBootstrapFiles(): void {
  const files: SoulFileType[] = ['soul', 'identity', 'agents', 'user'];
  for (const file of files) {
    const filePath = getSoulFilePath(file);
    if (!existsSync(filePath)) {
      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(filePath, getDefaultTemplate(file));
    }
  }
}
