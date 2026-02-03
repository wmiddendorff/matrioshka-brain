#!/usr/bin/env node
/**
 * Mudpuppy MCP Server
 *
 * Model Context Protocol server exposing Mudpuppy tools to Claude Code.
 * This is the core of Mudpuppy v2 - all capabilities are exposed as MCP tools.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { getAllTools, executeTool } from './tools/index.js';
import { getMudpuppyHome, isWorkspaceInitialized } from './config.js';

// Create MCP server
const server = new Server(
  {
    name: 'mudpuppy',
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
      inputSchema: zodToJsonSchema(tool.inputSchema, {
        $refStrategy: 'none',
        target: 'openApi3',
      }),
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
    console.error(`Mudpuppy workspace not initialized.`);
    console.error(`Run: mudpuppy init`);
    console.error(`Workspace: ${getMudpuppyHome()}`);
    // Continue anyway - tools can still work
  }

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`Mudpuppy MCP server started`);
  console.error(`Workspace: ${getMudpuppyHome()}`);
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
