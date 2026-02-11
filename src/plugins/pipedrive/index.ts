// Pipedrive plugin

import { z } from 'zod';
import { BasePlugin } from '../base.js';
import type { ToolDefinition } from '../../tools/index.js';

const PIPEDRIVE_API_TOKEN_KEY = 'PIPEDRIVE_API_TOKEN';
const PIPEDRIVE_DOMAIN_KEY = 'PIPEDRIVE_DOMAIN';

/**
 * Pipedrive API client
 */
class PipedriveClient {
  constructor(
    private apiToken: string,
    private domain: string
  ) {}

  private async request(endpoint: string, options?: RequestInit): Promise<any> {
    const url = `https://${this.domain}/api/v1${endpoint}`;
    const separator = endpoint.includes('?') ? '&' : '?';
    const urlWithToken = `${url}${separator}api_token=${this.apiToken}`;

    const response = await fetch(urlWithToken, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Pipedrive API error: ${response.statusText}`);
    }

    return response.json();
  }

  async getDeals(params?: { status?: string; filter_id?: number }): Promise<any> {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/deals${query ? '?' + query : ''}`);
  }

  async getDeal(id: number): Promise<any> {
    return this.request(`/deals/${id}`);
  }

  async updateDeal(id: number, data: Record<string, any>): Promise<any> {
    return this.request(`/deals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getActivities(params?: { deal_id?: number; type?: string }): Promise<any> {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/activities${query ? '?' + query : ''}`);
  }

  async createActivity(data: {
    subject: string;
    type: string;
    deal_id?: number;
    person_id?: number;
    due_date?: string;
    note?: string;
  }): Promise<any> {
    return this.request('/activities', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPersons(params?: { filter_id?: number; term?: string }): Promise<any> {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/persons${query ? '?' + query : ''}`);
  }

  async getPerson(id: number): Promise<any> {
    return this.request(`/persons/${id}`);
  }

  async addNote(data: {
    content: string;
    deal_id?: number;
    person_id?: number;
    org_id?: number;
  }): Promise<any> {
    return this.request('/notes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

/**
 * Pipedrive plugin implementation
 */
export class PipedrivePlugin extends BasePlugin {
  name = 'pipedrive';
  description = 'Pipedrive CRM integration';
  authType = 'api-key' as const;

  private client: PipedriveClient | null = null;

  private getClient(): PipedriveClient {
    if (this.client) return this.client;

    const apiToken = this.getSecret(PIPEDRIVE_API_TOKEN_KEY);
    const domain = this.getSecret(PIPEDRIVE_DOMAIN_KEY);

    if (!apiToken || !domain) {
      throw new Error('Pipedrive not configured. Run: matrioshka-brain plugins setup pipedrive');
    }

    this.client = new PipedriveClient(apiToken, domain);
    return this.client;
  }

  async isConfigured(): Promise<boolean> {
    return this.hasSecrets(PIPEDRIVE_API_TOKEN_KEY, PIPEDRIVE_DOMAIN_KEY);
  }

  async setup(options?: Record<string, unknown>): Promise<void> {
    if (options?.apiToken && options?.domain) {
      this.setSecret(PIPEDRIVE_API_TOKEN_KEY, options.apiToken as string);
      this.setSecret(PIPEDRIVE_DOMAIN_KEY, options.domain as string);
      return;
    }

    // Interactive setup
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = (prompt: string): Promise<string> => {
      return new Promise((resolve) => rl.question(prompt, resolve));
    };

    console.log('\n=== Pipedrive Setup ===\n');
    console.log('Get your API token from: Settings > Personal > API');
    console.log('Your domain is: yourcompany.pipedrive.com\n');

    const apiToken = await question('API Token: ');
    const domain = await question('Domain (e.g., yourcompany.pipedrive.com): ');

    rl.close();

    this.setSecret(PIPEDRIVE_API_TOKEN_KEY, apiToken.trim());
    this.setSecret(PIPEDRIVE_DOMAIN_KEY, domain.trim());

    console.log('\n✓ Pipedrive configured successfully!');
  }

  async getStatus(): Promise<{
    configured: boolean;
    authenticated: boolean;
    lastError?: string;
  }> {
    const configured = await this.isConfigured();
    if (!configured) {
      return { configured: false, authenticated: false };
    }

    try {
      const client = this.getClient();
      await client.getDeals({ status: 'open' });
      return { configured: true, authenticated: true };
    } catch (error) {
      return {
        configured: true,
        authenticated: false,
        lastError: error instanceof Error ? error.message : String(error),
      };
    }
  }

  registerTools(): ToolDefinition[] {
    return [
      // pipedrive_deals - List deals
      {
        name: 'pipedrive_deals',
        description: 'List deals from Pipedrive CRM',
        inputSchema: z.object({
          status: z.enum(['open', 'won', 'lost', 'deleted', 'all_not_deleted']).optional(),
          filter_id: z.number().optional().describe('Apply a predefined filter'),
        }),
        handler: async (input) => {
          const client = this.getClient();
          return client.getDeals(input as any);
        },
      },

      // pipedrive_deal_get - Get specific deal
      {
        name: 'pipedrive_deal_get',
        description: 'Get a specific deal by ID',
        inputSchema: z.object({
          id: z.number().describe('Deal ID'),
        }),
        handler: async (input) => {
          const client = this.getClient();
          const { id } = input as { id: number };
          return client.getDeal(id);
        },
      },

      // pipedrive_deal_update - Update deal
      {
        name: 'pipedrive_deal_update',
        description: 'Update a deal',
        inputSchema: z.object({
          id: z.number().describe('Deal ID'),
          data: z.record(z.unknown()).describe('Fields to update'),
        }),
        handler: async (input) => {
          const client = this.getClient();
          const { id, data } = input as { id: number; data: Record<string, any> };
          return client.updateDeal(id, data);
        },
      },

      // pipedrive_activities - List activities
      {
        name: 'pipedrive_activities',
        description: 'List activities from Pipedrive',
        inputSchema: z.object({
          deal_id: z.number().optional().describe('Filter by deal ID'),
          type: z.string().optional().describe('Activity type (call, meeting, task, etc.)'),
        }),
        handler: async (input) => {
          const client = this.getClient();
          return client.getActivities(input as any);
        },
      },

      // pipedrive_activity_create - Create activity
      {
        name: 'pipedrive_activity_create',
        description: 'Create a new activity in Pipedrive',
        inputSchema: z.object({
          subject: z.string().describe('Activity subject/title'),
          type: z.string().describe('Activity type (call, meeting, task, etc.)'),
          deal_id: z.number().optional().describe('Associated deal ID'),
          person_id: z.number().optional().describe('Associated person ID'),
          due_date: z.string().optional().describe('Due date (YYYY-MM-DD)'),
          note: z.string().optional().describe('Activity note'),
        }),
        handler: async (input) => {
          const client = this.getClient();
          return client.createActivity(input as any);
        },
      },

      // pipedrive_persons - List persons
      {
        name: 'pipedrive_persons',
        description: 'List persons (contacts) from Pipedrive',
        inputSchema: z.object({
          filter_id: z.number().optional().describe('Apply a predefined filter'),
          term: z.string().optional().describe('Search term'),
        }),
        handler: async (input) => {
          const client = this.getClient();
          return client.getPersons(input as any);
        },
      },

      // pipedrive_person_get - Get specific person
      {
        name: 'pipedrive_person_get',
        description: 'Get a specific person by ID',
        inputSchema: z.object({
          id: z.number().describe('Person ID'),
        }),
        handler: async (input) => {
          const client = this.getClient();
          const { id } = input as { id: number };
          return client.getPerson(id);
        },
      },

      // pipedrive_notes_add - Add note
      {
        name: 'pipedrive_notes_add',
        description: 'Add a note to a deal, person, or organization',
        inputSchema: z.object({
          content: z.string().describe('Note content'),
          deal_id: z.number().optional().describe('Associated deal ID'),
          person_id: z.number().optional().describe('Associated person ID'),
          org_id: z.number().optional().describe('Associated organization ID'),
        }),
        handler: async (input) => {
          const client = this.getClient();
          return client.addNote(input as any);
        },
      },
    ];
  }
}

// Export singleton instance
export const pipedrivePlugin = new PipedrivePlugin();
