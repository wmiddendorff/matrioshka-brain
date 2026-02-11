// Pre-built plugin definitions

import type { PluginDefinition } from './types.js';

/**
 * Gmail + Google Calendar plugin
 * Uses @presto-ai/google-workspace-mcp
 */
export const GMAIL_PLUGIN: PluginDefinition = {
  name: 'gmail',
  description: 'Google Workspace integration (Gmail + Calendar)',
  package: '@presto-ai/google-workspace-mcp',
  command: 'npx',
  args: ['-y', '@presto-ai/google-workspace-mcp'],
  envVars: [
    {
      name: 'GOOGLE_CLIENT_ID',
      description: 'Google OAuth Client ID (from Google Cloud Console)',
      required: true,
    },
    {
      name: 'GOOGLE_CLIENT_SECRET',
      description: 'Google OAuth Client Secret',
      required: true,
    },
    {
      name: 'GOOGLE_REDIRECT_URI',
      description: 'OAuth redirect URI (usually http://localhost:3000/callback)',
      required: true,
      defaultValue: 'http://localhost:3000/callback',
    },
  ],
  mcpConfig: {
    command: 'npx',
    args: ['-y', '@presto-ai/google-workspace-mcp'],
    env: {
      GOOGLE_CLIENT_ID: '${GOOGLE_CLIENT_ID}',
      GOOGLE_CLIENT_SECRET: '${GOOGLE_CLIENT_SECRET}',
      GOOGLE_REDIRECT_URI: '${GOOGLE_REDIRECT_URI}',
    },
  },
};

/**
 * Google Calendar (alias for gmail - same package)
 */
export const GOOGLE_CALENDAR_PLUGIN: PluginDefinition = {
  ...GMAIL_PLUGIN,
  name: 'google-calendar',
  description: 'Google Calendar integration (via Google Workspace MCP)',
};

/**
 * Microsoft Outlook + Calendar plugin
 * Uses @softeria/ms-365-mcp-server
 */
export const OUTLOOK_PLUGIN: PluginDefinition = {
  name: 'outlook',
  description: 'Microsoft 365 integration (Outlook + Calendar)',
  package: '@softeria/ms-365-mcp-server',
  command: 'npx',
  args: ['-y', '@softeria/ms-365-mcp-server'],
  envVars: [
    {
      name: 'AZURE_CLIENT_ID',
      description: 'Azure App Registration Client ID',
      required: true,
    },
    {
      name: 'AZURE_CLIENT_SECRET',
      description: 'Azure App Registration Client Secret',
      required: true,
    },
    {
      name: 'AZURE_TENANT_ID',
      description: 'Azure AD Tenant ID',
      required: true,
    },
  ],
  mcpConfig: {
    command: 'npx',
    args: ['-y', '@softeria/ms-365-mcp-server'],
    env: {
      AZURE_CLIENT_ID: '${AZURE_CLIENT_ID}',
      AZURE_CLIENT_SECRET: '${AZURE_CLIENT_SECRET}',
      AZURE_TENANT_ID: '${AZURE_TENANT_ID}',
    },
  },
};

/**
 * Pipedrive CRM plugin
 * Uses @pipedrive/mcp-server-pipedrive or similar
 */
export const PIPEDRIVE_PLUGIN: PluginDefinition = {
  name: 'pipedrive',
  description: 'Pipedrive CRM integration',
  package: '@modelcontextprotocol/server-pipedrive',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-pipedrive'],
  envVars: [
    {
      name: 'PIPEDRIVE_API_TOKEN',
      description: 'Pipedrive API token (from Settings > Personal > API)',
      required: true,
    },
    {
      name: 'PIPEDRIVE_DOMAIN',
      description: 'Pipedrive company domain (e.g., yourcompany.pipedrive.com)',
      required: true,
    },
  ],
  mcpConfig: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-pipedrive'],
    env: {
      PIPEDRIVE_API_TOKEN: '${PIPEDRIVE_API_TOKEN}',
      PIPEDRIVE_DOMAIN: '${PIPEDRIVE_DOMAIN}',
    },
  },
};

/**
 * All available plugin definitions
 */
export const PLUGIN_DEFINITIONS: Record<string, PluginDefinition> = {
  gmail: GMAIL_PLUGIN,
  'google-calendar': GOOGLE_CALENDAR_PLUGIN,
  outlook: OUTLOOK_PLUGIN,
  pipedrive: PIPEDRIVE_PLUGIN,
};

/**
 * Get plugin definition by name
 */
export function getPluginDefinition(name: string): PluginDefinition | undefined {
  return PLUGIN_DEFINITIONS[name];
}

/**
 * List all available plugin names
 */
export function listAvailablePlugins(): string[] {
  return Object.keys(PLUGIN_DEFINITIONS);
}
