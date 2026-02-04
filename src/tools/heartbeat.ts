/**
 * Heartbeat MCP Tools
 *
 * MCP tools for monitoring and controlling the heartbeat scheduler:
 * - heartbeat_status: Get current heartbeat state
 * - heartbeat_pause: Pause the heartbeat
 * - heartbeat_resume: Resume the heartbeat
 */

import { z } from 'zod';
import { registerTool } from './index.js';

// ============================================
// heartbeat_status - Get heartbeat state
// ============================================

registerTool({
  name: 'heartbeat_status',
  description:
    'Get the status of the heartbeat scheduler. Returns whether it is enabled, paused, ' +
    'the interval, last/next run timestamps, pending task count, and active hours status.',
  inputSchema: z.object({}),
  handler: async () => {
    const { getScheduler, isInActiveHours } = await import('../autonomy/scheduler.js');
    const { ConfigManager } = await import('../config.js');

    const scheduler = getScheduler();
    if (!scheduler) {
      const config = new ConfigManager();
      const enabled = config.getValue<boolean>('heartbeat.enabled') ?? false;
      return {
        enabled: false,
        paused: false,
        interval: config.getValue<number>('heartbeat.interval') ?? 1800000,
        lastRun: null,
        nextRun: null,
        pendingTasks: 0,
        inActiveHours: isInActiveHours(config.getValue('heartbeat.activeHours')),
        message: enabled
          ? 'Heartbeat is enabled in config but scheduler is not running. Restart the MCP server.'
          : 'Heartbeat is disabled. Enable with: matrioshka-brain config set heartbeat.enabled true',
      };
    }

    return scheduler.getState();
  },
});

// ============================================
// heartbeat_pause - Pause the heartbeat
// ============================================

registerTool({
  name: 'heartbeat_pause',
  description:
    'Pause the heartbeat scheduler. The timer keeps running but ticks will be skipped. ' +
    'Use heartbeat_resume to resume.',
  inputSchema: z.object({}),
  handler: async () => {
    const { getScheduler } = await import('../autonomy/scheduler.js');

    const scheduler = getScheduler();
    if (!scheduler) {
      return { success: false, error: 'Heartbeat scheduler is not running.' };
    }

    const wasPaused = scheduler.pause();
    return { success: true, wasPaused };
  },
});

// ============================================
// heartbeat_resume - Resume the heartbeat
// ============================================

registerTool({
  name: 'heartbeat_resume',
  description:
    'Resume the heartbeat scheduler after being paused. ' +
    'The next tick will execute at the configured interval from now.',
  inputSchema: z.object({}),
  handler: async () => {
    const { getScheduler } = await import('../autonomy/scheduler.js');

    const scheduler = getScheduler();
    if (!scheduler) {
      return { success: false, error: 'Heartbeat scheduler is not running.' };
    }

    scheduler.resume();
    const state = scheduler.getState();
    return { success: true, nextRun: state.nextRun };
  },
});
