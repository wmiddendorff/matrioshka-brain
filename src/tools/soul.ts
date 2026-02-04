/**
 * Soul MCP Tools
 *
 * MCP tools for personality persistence:
 * - soul_read: Read a soul/identity file
 * - soul_propose_update: Propose changes to soul/agents files (requires approval)
 */

import { z } from 'zod';
import { registerTool } from './index.js';

const soulFileEnum = z.enum(['soul', 'identity', 'agents', 'user']);
const proposableFileEnum = z.enum(['soul', 'agents']);

// ============================================
// soul_read - Read a soul/identity file
// ============================================

registerTool({
  name: 'soul_read',
  description:
    'Read a soul/identity bootstrap file. Returns the current file content. ' +
    'Files: soul (SOUL.md), identity (IDENTITY.md), agents (AGENTS.md), user (USER.md). ' +
    'Creates the file from a default template if it does not exist.',
  inputSchema: z.object({
    file: soulFileEnum.describe('Which file to read: soul, identity, agents, or user'),
  }),
  handler: async (input) => {
    const { file } = input as { file: 'soul' | 'identity' | 'agents' | 'user' };

    const { ensureBootstrapFiles, readSoulFile } = await import('../soul/files.js');

    try {
      ensureBootstrapFiles();
      const result = readSoulFile(file);
      return {
        file: result.file,
        content: result.content,
        lastModified: result.lastModified,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

// ============================================
// soul_propose_update - Propose a soul file change
// ============================================

registerTool({
  name: 'soul_propose_update',
  description:
    'Propose an update to a soul or agents file. Creates a pending approval ' +
    'with a unified diff showing the changes. The user must approve or deny ' +
    'the proposal via the CLI before the file is updated. ' +
    'Only soul (SOUL.md) and agents (AGENTS.md) can be proposed for update.',
  inputSchema: z.object({
    file: proposableFileEnum.describe('Which file to update: soul or agents'),
    newContent: z.string().min(1).describe('The proposed new content for the file'),
    reason: z.string().min(1).describe('Why this change is being proposed'),
  }),
  handler: async (input) => {
    const { file, newContent, reason } = input as {
      file: 'soul' | 'agents';
      newContent: string;
      reason: string;
    };

    const { readSoulFile } = await import('../soul/files.js');
    const { unifiedDiff } = await import('../soul/diff.js');
    const { SOUL_FILE_MAP } = await import('../soul/types.js');
    const { getApprovalDb, createApproval } = await import('../approval/db.js');

    try {
      const current = readSoulFile(file);
      const diff = unifiedDiff(current.content, newContent, {
        fromLabel: `current/${SOUL_FILE_MAP[file]}`,
        toLabel: `proposed/${SOUL_FILE_MAP[file]}`,
      });

      if (!diff) {
        return {
          error: 'No changes detected - proposed content is identical to current content.',
        };
      }

      const db = getApprovalDb();
      const approval = createApproval(db, 'soul_update', {
        file,
        filename: SOUL_FILE_MAP[file],
        newContent,
        reason,
        diff,
      });

      return {
        proposalId: approval.id,
        diff,
        status: 'pending',
        message: `Proposal created. Use "matrioshka-brain soul list" to view, "matrioshka-brain soul approve ${approval.id}" to apply.`,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
