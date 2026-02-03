/**
 * Memory MCP Tools
 *
 * MCP tools for memory persistence:
 * - memory_add: Create a memory entry
 * - memory_search: Search memories (hybrid/vector/keyword)
 * - memory_get: Get a memory by ID
 * - memory_stats: Get memory statistics
 * - memory_delete: Delete a memory by ID
 */

import { z } from 'zod';
import { registerTool } from './index.js';

const entryTypeEnum = z.enum(['fact', 'preference', 'event', 'insight', 'task', 'relationship']);
const searchModeEnum = z.enum(['hybrid', 'vector', 'keyword']);

// ============================================
// memory_add - Create a memory entry
// ============================================

registerTool({
  name: 'memory_add',
  description:
    'Add a new memory entry. Automatically generates embeddings for search. ' +
    'Deduplicates by content hash - adding the same content twice returns the existing entry.',
  inputSchema: z.object({
    content: z.string().min(1).describe('The memory content text'),
    entryType: entryTypeEnum
      .optional()
      .default('fact')
      .describe('Type of memory: fact, preference, event, insight, task, relationship'),
    source: z.string().optional().describe('Source of the memory (default: "manual")'),
    context: z.string().optional().describe('Additional context about the memory'),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Confidence level 0-1 (default: 1.0)'),
    importance: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe('Importance level 1-10 (default: 5)'),
    tags: z.array(z.string()).optional().describe('Tags for categorization'),
    expiresAt: z
      .number()
      .int()
      .optional()
      .describe('Unix timestamp when this memory expires (optional)'),
  }),
  handler: async (input) => {
    const params = input as {
      content: string;
      entryType?: string;
      source?: string;
      context?: string;
      confidence?: number;
      importance?: number;
      tags?: string[];
      expiresAt?: number;
    };

    const { getMemoryDb, addEntry } = await import('../memory/db.js');
    const { generateEmbedding } = await import('../memory/embeddings.js');
    const { appendToDailyLog } = await import('../memory/daily-log.js');

    try {
      const db = getMemoryDb();
      const entryType = (params.entryType ?? 'fact') as 'fact' | 'preference' | 'event' | 'insight' | 'task' | 'relationship';
      const source = params.source ?? 'manual';
      const embedding = await generateEmbedding(params.content);
      const result = addEntry(db, {
        content: params.content,
        entryType,
        source,
        context: params.context,
        confidence: params.confidence,
        importance: params.importance,
        tags: params.tags,
        expiresAt: params.expiresAt,
      }, embedding);

      // Append to daily log for new entries (skip file-index to prevent feedback loops)
      if (result.created && source !== 'file-index') {
        try {
          appendToDailyLog(params.content, entryType, source);
        } catch {
          // Non-fatal: don't fail the add if daily log write fails
        }
      }

      return result;
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

// ============================================
// memory_search - Search memories
// ============================================

registerTool({
  name: 'memory_search',
  description:
    'Search memories using hybrid search (vector + keyword). ' +
    'Combines semantic similarity with keyword matching for best results.',
  inputSchema: z.object({
    query: z.string().min(1).describe('Search query text'),
    mode: searchModeEnum
      .optional()
      .default('hybrid')
      .describe('Search mode: hybrid (default), vector, or keyword'),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .default(10)
      .describe('Maximum results to return (default: 10)'),
    entryTypes: z
      .array(entryTypeEnum)
      .optional()
      .describe('Filter by entry types'),
    minImportance: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe('Minimum importance level'),
    minConfidence: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Minimum confidence level'),
    tags: z.array(z.string()).optional().describe('Filter by tags (any match)'),
  }),
  handler: async (input) => {
    const params = input as {
      query: string;
      mode?: 'hybrid' | 'vector' | 'keyword';
      limit?: number;
      entryTypes?: string[];
      minImportance?: number;
      minConfidence?: number;
      tags?: string[];
    };

    const { getMemoryDb } = await import('../memory/db.js');
    const { hybridSearch } = await import('../memory/search.js');
    const { ConfigManager } = await import('../config.js');

    try {
      const db = getMemoryDb();
      const config = new ConfigManager();
      const weights = config.getValue<{ vector: number; keyword: number }>('memory.hybridWeights');

      const results = await hybridSearch(db, {
        query: params.query,
        mode: params.mode,
        limit: params.limit,
        entryTypes: params.entryTypes as ('fact' | 'preference' | 'event' | 'insight' | 'task' | 'relationship')[] | undefined,
        minImportance: params.minImportance,
        minConfidence: params.minConfidence,
        tags: params.tags,
        vectorWeight: weights?.vector,
        keywordWeight: weights?.keyword,
      });

      return {
        results: results.map((r) => ({
          id: r.entry.id,
          content: r.entry.content,
          entryType: r.entry.entryType,
          source: r.entry.source,
          context: r.entry.context,
          confidence: r.entry.confidence,
          importance: r.entry.importance,
          tags: r.entry.tags,
          score: Math.round(r.score * 1000) / 1000,
          matchedBy: r.matchedBy,
          createdAt: r.entry.createdAt,
        })),
        total: results.length,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        results: [],
        total: 0,
      };
    }
  },
});

// ============================================
// memory_get - Get a memory by ID
// ============================================

registerTool({
  name: 'memory_get',
  description: 'Get a memory entry by ID. Logs the access for analytics.',
  inputSchema: z.object({
    id: z.number().int().positive().describe('Memory entry ID'),
  }),
  handler: async (input) => {
    const { id } = input as { id: number };

    const { getMemoryDb, getEntry, logAccess } = await import('../memory/db.js');

    try {
      const db = getMemoryDb();
      const entry = getEntry(db, id);

      if (!entry) {
        return { error: `Memory entry not found: ${id}` };
      }

      // Log the access
      logAccess(db, id, 'get');

      return { entry };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

// ============================================
// memory_stats - Get memory statistics
// ============================================

registerTool({
  name: 'memory_stats',
  description: 'Get statistics about stored memories: counts by type, averages, totals.',
  inputSchema: z.object({}),
  handler: async () => {
    const { getMemoryDb, getStats } = await import('../memory/db.js');

    try {
      const db = getMemoryDb();
      return getStats(db);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

// ============================================
// memory_delete - Delete a memory by ID
// ============================================

registerTool({
  name: 'memory_delete',
  description: 'Delete a memory entry by ID. Removes the entry, its embedding, and FTS index.',
  inputSchema: z.object({
    id: z.number().int().positive().describe('Memory entry ID to delete'),
  }),
  handler: async (input) => {
    const { id } = input as { id: number };

    const { getMemoryDb, deleteEntry } = await import('../memory/db.js');

    try {
      const db = getMemoryDb();
      const deleted = deleteEntry(db, id);

      return { success: deleted, deleted };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        success: false,
        deleted: false,
      };
    }
  },
});
