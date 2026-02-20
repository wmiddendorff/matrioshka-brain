/**
 * Orchestrator Prompt Builder
 *
 * Builds the prompt passed to Claude Code based on active triggers.
 */

import type { Trigger } from './types.js';

const HEADER =
  'You are running in autonomous mode via the orchestrator. Be concise. Complete the task and exit.';

export interface PromptBuildResult {
  prompt: string;
  summary: string;
}

function summarizeTriggers(triggers: Trigger[]): string {
  if (triggers.length === 0) return 'none';
  return triggers
    .map((trigger) => {
      if (trigger.type === 'telegram') {
        const count = (trigger.data as { count?: number } | undefined)?.count;
        return count ? `telegram(${count})` : 'telegram';
      }
      if (trigger.type === 'cron') {
        const jobs = (trigger.data as { jobs?: unknown[] } | undefined)?.jobs;
        return jobs ? `cron(${jobs.length})` : 'cron';
      }
      return trigger.type;
    })
    .join(', ');
}

export function buildPrompt(triggers: Trigger[]): PromptBuildResult {
  const lines: string[] = [HEADER, ''];

  for (const trigger of triggers) {
    switch (trigger.type) {
      case 'telegram': {
        const count = (trigger.data as { count?: number } | undefined)?.count ?? 0;
        lines.push(
          `You have ${count} pending Telegram messages. Use telegram_poll to read them, then respond appropriately using telegram_send.`
        );
        break;
      }
      case 'heartbeat':
        lines.push(
          'Run your heartbeat check. Use heartbeat_status to see pending tasks, then execute them.'
        );
        break;
      case 'cron': {
        const jobs = (trigger.data as { jobs?: Array<{ id: string; description?: string }> } | undefined)?.jobs ?? [];
        if (jobs.length === 0) {
          lines.push('Execute scheduled tasks from cron.');
        } else if (jobs.length === 1) {
          const job = jobs[0];
          const desc = job.description ? `: ${job.description}` : '';
          lines.push(`Execute scheduled task ${job.id}${desc}.`);
        } else {
          lines.push('Execute scheduled tasks:');
          for (const job of jobs) {
            const desc = job.description ? `: ${job.description}` : '';
            lines.push(`- ${job.id}${desc}`);
          }
        }
        break;
      }
      case 'manual':
        lines.push(String(trigger.data ?? trigger.summary));
        break;
      default:
        lines.push(trigger.summary);
        break;
    }
  }

  const prompt = lines.join('\n');
  const summary = summarizeTriggers(triggers);
  return { prompt, summary };
}
