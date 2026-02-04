#!/usr/bin/env node
/**
 * Matrioshka Brain MCP Server
 *
 * Model Context Protocol server exposing Matrioshka Brain tools to Claude Code.
 * This is the core of Matrioshka Brain v2 - all capabilities are exposed as MCP tools.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { getAllTools, executeTool, initTools } from './tools/index.js';
import { getMatrioshkaBrainHome, isWorkspaceInitialized, ConfigManager } from './config.js';

// Create MCP server
const server = new Server(
  {
    name: 'matrioshka-brain',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = getAllTools();

  return {
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: (() => {
        // Generate JSON Schema compatible with draft 2020-12
        // Note: 'openApi3' target generates boolean exclusiveMinimum which is invalid
        const schema = zodToJsonSchema(tool.inputSchema, {
          $refStrategy: 'none',
        }) as Record<string, unknown>;
        // Remove $schema property - MCP doesn't need it
        delete schema.$schema;
        return schema;
      })(),
    })),
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await executeTool(name, args || {});

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: message }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  // Check workspace initialization
  if (!isWorkspaceInitialized()) {
    console.error(`Matrioshka Brain workspace not initialized.`);
    console.error(`Run: matrioshka-brain init`);
    console.error(`Workspace: ${getMatrioshkaBrainHome()}`);
    // Continue anyway - tools can still work
  }

  // Initialize all tools before starting server
  await initTools();

  // Start file auto-indexer if configured
  try {
    const config = new ConfigManager();
    if (config.getValue<boolean>('memory.autoIndex')) {
      const { startIndexer } = await import('./memory/indexer.js');
      const interval = config.getValue<number>('memory.indexInterval') ?? 5000;
      await startIndexer({ interval });
      console.error(`Matrioshka Brain file indexer started (interval: ${interval}ms)`);
    }
  } catch (err) {
    console.error('Failed to start file indexer:', err);
    // Non-fatal: server continues without indexer
  }

  // Start heartbeat scheduler if configured
  try {
    const config2 = new ConfigManager();
    if (config2.getValue<boolean>('heartbeat.enabled')) {
      const { HeartbeatScheduler } = await import('./autonomy/scheduler.js');
      const scheduler = new HeartbeatScheduler({
        interval: config2.getValue<number>('heartbeat.interval') ?? 1800000,
        activeHours: config2.getValue('heartbeat.activeHours'),
        maxActionsPerBeat: config2.getValue<number>('heartbeat.maxActionsPerBeat') ?? 5,
        requireApproval: config2.getValue<boolean>('heartbeat.requireApproval') ?? true,
      });
      scheduler.start();
      console.error(`Matrioshka Brain heartbeat started (interval: ${scheduler.getState().interval}ms)`);
    }
  } catch (err) {
    console.error('Failed to start heartbeat scheduler:', err);
    // Non-fatal: server continues without heartbeat
  }

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`Matrioshka Brain MCP server started`);
  console.error(`Workspace: ${getMatrioshkaBrainHome()}`);
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
