/**
 * Prompt Builder Tests
 */

import { describe, it, expect } from 'vitest';
import { buildPrompt } from '../../src/orchestrator/prompts.js';
import type { Trigger } from '../../src/orchestrator/types.js';

describe('prompts', () => {
  it('builds telegram prompt with message count', () => {
    const triggers: Trigger[] = [
      { type: 'telegram', summary: '3 messages', priority: 10, data: { count: 3 } },
    ];
    const { prompt, summary } = buildPrompt(triggers);
    expect(prompt).toContain('3 pending Telegram messages');
    expect(prompt).toContain('telegram_poll');
    expect(prompt).toContain('autonomous mode');
    expect(summary).toBe('telegram(3)');
  });

  it('builds heartbeat prompt', () => {
    const triggers: Trigger[] = [
      { type: 'heartbeat', summary: 'heartbeat due', priority: 1 },
    ];
    const { prompt, summary } = buildPrompt(triggers);
    expect(prompt).toContain('heartbeat check');
    expect(prompt).toContain('heartbeat_status');
    expect(summary).toBe('heartbeat');
  });

  it('builds cron prompt with job details', () => {
    const triggers: Trigger[] = [
      {
        type: 'cron',
        summary: '1 job',
        priority: 5,
        data: { jobs: [{ id: 'daily-report', description: 'Generate daily report' }] },
      },
    ];
    const { prompt, summary } = buildPrompt(triggers);
    expect(prompt).toContain('daily-report');
    expect(prompt).toContain('Generate daily report');
    expect(summary).toBe('cron(1)');
  });

  it('builds manual prompt', () => {
    const triggers: Trigger[] = [
      { type: 'manual', summary: 'custom task', priority: 100, data: 'Do the thing' },
    ];
    const { prompt } = buildPrompt(triggers);
    expect(prompt).toContain('Do the thing');
  });

  it('combines multiple triggers', () => {
    const triggers: Trigger[] = [
      { type: 'manual', summary: 'task', priority: 100, data: 'Fix bug' },
      { type: 'telegram', summary: '1 message', priority: 10, data: { count: 1 } },
    ];
    const { prompt, summary } = buildPrompt(triggers);
    expect(prompt).toContain('Fix bug');
    expect(prompt).toContain('Telegram');
    expect(summary).toBe('manual, telegram(1)');
  });

  it('handles empty triggers', () => {
    const { prompt, summary } = buildPrompt([]);
    expect(prompt).toContain('autonomous mode');
    expect(summary).toBe('none');
  });
});
