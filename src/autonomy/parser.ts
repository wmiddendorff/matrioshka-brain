/**
 * Heartbeat Parser
 *
 * Parses HEARTBEAT.md content to extract tasks.
 * - Extracts unchecked items: `- [ ] ...`
 * - Skips checked items: `- [x] ...`
 * - Detects `@tool_name` prefix for executable tasks
 * - Identifies section from `## Recurring` / `## One-time` headers
 */

import type { HeartbeatTask, TaskSection } from './types.js';

/** Regex for unchecked task lines */
const UNCHECKED_RE = /^- \[ \] (.+)$/;

/** Regex for section headers */
const SECTION_RE = /^## (.+)$/;

/** Regex for @tool prefix with optional JSON args */
const TOOL_RE = /^@(\w+)\s*(.*)$/;

/**
 * Parse HEARTBEAT.md content into an array of HeartbeatTask objects.
 * Only returns unchecked (`- [ ]`) tasks.
 */
export function parseHeartbeatMd(content: string): HeartbeatTask[] {
  const lines = content.split('\n');
  const tasks: HeartbeatTask[] = [];
  let currentSection: TaskSection = 'unknown';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check for section headers
    const sectionMatch = line.match(SECTION_RE);
    if (sectionMatch) {
      const heading = sectionMatch[1].trim().toLowerCase();
      if (heading === 'recurring') {
        currentSection = 'recurring';
      } else if (heading === 'one-time') {
        currentSection = 'one-time';
      } else {
        currentSection = 'unknown';
      }
      continue;
    }

    // Check for unchecked tasks
    const taskMatch = line.match(UNCHECKED_RE);
    if (!taskMatch) continue;

    const text = taskMatch[1].trim();
    const task: HeartbeatTask = {
      text,
      section: currentSection,
      lineIndex: i,
    };

    // Check for @tool prefix
    const toolMatch = text.match(TOOL_RE);
    if (toolMatch) {
      const toolName = toolMatch[1];
      let input: Record<string, unknown> = {};

      const argsStr = toolMatch[2].trim();
      if (argsStr) {
        try {
          input = JSON.parse(argsStr);
        } catch {
          // Malformed JSON — treat as plain text task (not executable)
          tasks.push(task);
          continue;
        }
      }

      task.toolCall = { tool: toolName, input };
    }

    tasks.push(task);
  }

  return tasks;
}

/**
 * Mark a task as done in the HEARTBEAT.md content by replacing
 * `- [ ]` with `- [x]` at the given line index.
 * Returns the updated content string.
 */
export function markTaskDone(content: string, lineIndex: number): string {
  const lines = content.split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) {
    return content;
  }

  lines[lineIndex] = lines[lineIndex].replace('- [ ]', '- [x]');
  return lines.join('\n');
}
