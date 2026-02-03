/**
 * Soul Module
 *
 * Personality persistence via bootstrap files (SOUL.md, IDENTITY.md,
 * AGENTS.md, USER.md) with an approval system for proposed changes.
 */

export type { SoulFileType, ProposableSoulFile, SoulReadResult } from './types.js';
export { SOUL_FILE_MAP } from './types.js';

export { getDefaultTemplate } from './templates.js';

export { unifiedDiff, type DiffOptions } from './diff.js';

export {
  getSoulFilePath,
  readSoulFile,
  writeSoulFile,
  ensureBootstrapFiles,
} from './files.js';
