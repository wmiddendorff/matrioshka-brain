#!/usr/bin/env node
/**
 * Mudpuppy CLI
 *
 * Command-line interface for managing Mudpuppy.
 */

import { ConfigManager, getMudpuppyHome, initWorkspace, isWorkspaceInitialized, resolvePath } from '../config.js';
import { SecretsManager } from '../secrets.js';
import {
  startDaemon,
  stopDaemon,
  restartDaemon,
  isDaemonRunning,
  getDaemonInfo,
  checkConnection,
} from '../telegram/index.js';

const VERSION = '2.0.0';

function printHelp(): void {
  console.log(`
Mudpuppy v${VERSION} - MCP-first autonomous AI agent

Usage: mudpuppy <command> [options]

Commands:
  init                    Initialize workspace at $MUDPUPPY_HOME
  config get [path]       Get config value (or full config if no path)
  config set <path> <val> Set config value
  status                  Show system status
  version                 Show version

Telegram:
  telegram start          Start Telegram bot daemon
  telegram stop           Stop Telegram bot daemon
  telegram restart        Restart Telegram bot daemon
  telegram status         Show bot status
  telegram set-token      Set bot token (will prompt)

Environment:
  MUDPUPPY_HOME           Workspace directory (default: ~/.mudpuppy)

Examples:
  mudpuppy init
  mudpuppy config get telegram.enabled
  mudpuppy config set telegram.enabled true
  mudpuppy telegram set-token <token>
  mudpuppy telegram start
`);
}

function printVersion(): void {
  console.log(`Mudpuppy v${VERSION}`);
  console.log(`Workspace: ${getMudpuppyHome()}`);
  console.log(`Initialized: ${isWorkspaceInitialized() ? 'Yes' : 'No'}`);
}

async function cmdInit(): Promise<void> {
  console.log(`Initializing Mudpuppy workspace...`);
  console.log(`Location: ${getMudpuppyHome()}`);
  console.log();

  const { created, existed } = initWorkspace();

  if (created.length > 0) {
    console.log('Created directories:');
    created.forEach((d) => console.log(`  + ${d}`));
  }

  if (existed.length > 0) {
    console.log('Already existed:');
    existed.forEach((d) => console.log(`  . ${d}`));
  }

  // Create default config if not exists
  const config = new ConfigManager();
  if (!isWorkspaceInitialized()) {
    config.save();
    console.log(`\nCreated config: ${config.getConfigPath()}`);
  } else {
    console.log(`\nConfig exists: ${config.getConfigPath()}`);
  }

  // Create default workspace files if not exist
  await createDefaultWorkspaceFiles();

  console.log('\n✅ Workspace initialized!');
  console.log('\nNext steps:');
  console.log('  1. Configure Telegram: mudpuppy config set telegram.enabled true');
  console.log('  2. Set bot token in ~/.mudpuppy/secrets.env');
  console.log('  3. Start bot: mudpuppy telegram start');
}

async function createDefaultWorkspaceFiles(): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  const files: Record<string, string> = {
    'workspace/SOUL.md': `# Soul

## Core Essence
I am Mudpuppy, an AI companion that learns and evolves through our interactions.
Like my namesake salamander, I never stop growing and adapting.

## Communication Style
- Direct and helpful
- Curious and engaged
- Respectful of boundaries

## Boundaries
- I ask before taking significant actions
- I maintain user privacy
- I acknowledge my limitations

## Evolution
*This section will grow as I learn about you and our interactions.*
`,

    'workspace/IDENTITY.md': `# Identity

- **Name**: Mudpuppy
- **Type**: AI Companion
- **Vibe**: Curious, helpful, always learning
- **Emoji**: 🐾
`,

    'workspace/AGENTS.md': `# Operating Instructions

## Memory Protocol
- Log significant events to daily memory files
- Update MEMORY.md with important facts
- Search memory before answering questions about past interactions

## Safety Rules
- Never execute commands without approval
- Ask for clarification when uncertain
- Respect user privacy and data boundaries

## Autonomous Behavior
- Check HEARTBEAT.md for pending tasks
- Only act during active hours (if configured)
- Always log actions to audit trail
`,

    'workspace/USER.md': `# User Profile

*Add information about yourself here for better personalization.*

## Preferences
- (Your preferences)

## Context
- (Information about your work, projects, etc.)
`,

    'workspace/MEMORY.md': `# Long-term Memory

*Curated facts and learnings that persist across sessions.*

## Key Facts
- Workspace initialized on ${new Date().toISOString().split('T')[0]}

## Preferences
- (Learned preferences will appear here)

## Insights
- (Patterns and learnings will appear here)
`,

    'workspace/HEARTBEAT.md': `# Heartbeat Tasks

## Recurring
- [ ] Check for important notifications

## One-time
- (Add tasks here)

---
HEARTBEAT_OK
`,

    'tools/manifest.md': `# Mudpuppy Tools

## Config
| Tool | Purpose | Requires Approval |
|------|---------|-------------------|
| config_get | Get configuration value | No |
| config_set | Set configuration value | No |

## Telegram (Phase 1)
| Tool | Purpose | Requires Approval |
|------|---------|-------------------|
| telegram_poll | Get pending messages | No |
| telegram_send | Send message | No |
| telegram_pair | Approve pairing | Yes |
| telegram_status | Get bot status | No |

## Memory (Phase 2)
| Tool | Purpose | Requires Approval |
|------|---------|-------------------|
| memory_search | Search memories | No |
| memory_add | Add new memory | No |
| memory_get | Get specific memory | No |
| memory_stats | Get statistics | No |

## Soul (Phase 3)
| Tool | Purpose | Requires Approval |
|------|---------|-------------------|
| soul_read | Read soul/identity files | No |
| soul_propose_update | Propose soul change | Yes |

## Heartbeat (Phase 4)
| Tool | Purpose | Requires Approval |
|------|---------|-------------------|
| heartbeat_status | Get heartbeat status | No |
| heartbeat_pause | Pause heartbeat | No |
| heartbeat_resume | Resume heartbeat | No |
`,
  };

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = resolvePath(relativePath);
    if (!fs.existsSync(fullPath)) {
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(fullPath, content);
      console.log(`  + ${relativePath}`);
    }
  }
}

function cmdConfigGet(path?: string): void {
  const config = new ConfigManager();

  if (path) {
    const value = config.getValue(path);
    if (value === undefined) {
      console.error(`Config path not found: ${path}`);
      process.exit(1);
    }
    console.log(JSON.stringify(value, null, 2));
  } else {
    console.log(JSON.stringify(config.get(), null, 2));
  }
}

function cmdConfigSet(path: string, value: string): void {
  const config = new ConfigManager();

  // Parse value (try JSON first, then string)
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    // Handle special values
    if (value === 'true') parsed = true;
    else if (value === 'false') parsed = false;
    else if (!isNaN(Number(value))) parsed = Number(value);
    else parsed = value;
  }

  config.setValue(path, parsed);
  config.save();

  console.log(`Set ${path} = ${JSON.stringify(parsed)}`);
}

function cmdStatus(): void {
  console.log(`Mudpuppy v${VERSION}`);
  console.log();
  console.log(`Workspace: ${getMudpuppyHome()}`);
  console.log(`Initialized: ${isWorkspaceInitialized() ? 'Yes' : 'No'}`);

  if (isWorkspaceInitialized()) {
    const config = new ConfigManager();
    const cfg = config.get();

    console.log();
    console.log('Configuration:');
    console.log(`  Telegram: ${cfg.telegram.enabled ? 'Enabled' : 'Disabled'}`);
    console.log(`  Memory: ${cfg.memory.embeddingProvider} embeddings`);
    console.log(`  Heartbeat: ${cfg.heartbeat.enabled ? `${cfg.heartbeat.interval / 60000}min` : 'Disabled'}`);
    console.log(`  Audit Log: ${cfg.security.auditLog ? 'Enabled' : 'Disabled'}`);
  }
}

// ============================================
// Telegram Commands
// ============================================

async function cmdTelegram(args: string[]): Promise<void> {
  const subCmd = args[0];

  switch (subCmd) {
    case 'start':
      await cmdTelegramStart();
      break;

    case 'stop':
      cmdTelegramStop();
      break;

    case 'restart':
      await cmdTelegramRestart();
      break;

    case 'status':
      await cmdTelegramStatus();
      break;

    case 'set-token':
      cmdTelegramSetToken(args[1]);
      break;

    default:
      console.error(`Unknown telegram command: ${subCmd}`);
      console.error('Available commands: start, stop, restart, status, set-token');
      process.exit(1);
  }
}

async function cmdTelegramStart(): Promise<void> {
  // Check if already running
  if (isDaemonRunning()) {
    console.log('Telegram bot daemon is already running');
    const info = getDaemonInfo();
    console.log(`PID: ${info.pid}`);
    return;
  }

  // Check for bot token
  const secrets = new SecretsManager();
  if (!secrets.has('TELEGRAM_BOT_TOKEN')) {
    console.error('TELEGRAM_BOT_TOKEN not set');
    console.error('Set it with: mudpuppy telegram set-token <token>');
    process.exit(1);
  }

  console.log('Starting Telegram bot daemon...');

  try {
    const pid = await startDaemon();
    console.log(`Daemon started with PID ${pid}`);
    console.log();

    // Wait a moment and check status
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const connection = await checkConnection();

    if (connection.reachable && connection.status) {
      console.log(`Bot: @${connection.status.botUsername}`);
      console.log(`Paired users: ${connection.status.pairedUsers}`);
      console.log(`Pending requests: ${connection.status.pendingRequests}`);
    }
  } catch (error) {
    console.error('Failed to start daemon:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function cmdTelegramStop(): void {
  if (!isDaemonRunning()) {
    console.log('Telegram bot daemon is not running');
    return;
  }

  console.log('Stopping Telegram bot daemon...');
  const stopped = stopDaemon();

  if (stopped) {
    console.log('Daemon stopped');
  } else {
    console.log('Daemon was not running');
  }
}

async function cmdTelegramRestart(): Promise<void> {
  console.log('Restarting Telegram bot daemon...');

  try {
    const pid = await restartDaemon();
    console.log(`Daemon restarted with PID ${pid}`);
  } catch (error) {
    console.error('Failed to restart daemon:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function cmdTelegramStatus(): Promise<void> {
  const info = getDaemonInfo();

  if (!info.running) {
    console.log('Telegram bot daemon: Not running');
    console.log();
    console.log('Start with: mudpuppy telegram start');
    return;
  }

  console.log(`Telegram bot daemon: Running (PID ${info.pid})`);

  // Try to get detailed status
  try {
    const connection = await checkConnection();

    if (!connection.reachable) {
      console.log(`Status: Unreachable (${connection.error})`);
      return;
    }

    const status = connection.status!;
    console.log();
    console.log(`Bot: @${status.botUsername} (${status.botName})`);
    console.log(`Started: ${new Date(status.startedAt!).toLocaleString()}`);
    console.log();
    console.log(`Paired users: ${status.pairedUsers}`);
    console.log(`Pending requests: ${status.pendingRequests}`);
    console.log(`Unread messages: ${status.unreadMessages}`);

    if (status.lastError) {
      console.log();
      console.log(`Last error: ${status.lastError}`);
    }
  } catch (error) {
    console.log(`Status: Error communicating with daemon`);
    console.log(`  ${error instanceof Error ? error.message : error}`);
  }
}

function cmdTelegramSetToken(token?: string): void {
  if (!token) {
    console.error('Usage: mudpuppy telegram set-token <token>');
    console.error();
    console.error('Get a token from @BotFather on Telegram');
    process.exit(1);
  }

  // Basic validation
  if (!token.includes(':')) {
    console.error('Invalid token format. Telegram bot tokens contain a colon (:)');
    console.error('Example: 123456789:ABCdefGHIjklMNOpqrSTUvwxYZ');
    process.exit(1);
  }

  const secrets = new SecretsManager();
  secrets.set('TELEGRAM_BOT_TOKEN', token);
  secrets.save();

  console.log(`Token saved to ${secrets.getSecretsPath()}`);
  console.log();

  // Restart daemon if running
  if (isDaemonRunning()) {
    console.log('Daemon is running. Restart it to use the new token:');
    console.log('  mudpuppy telegram restart');
  } else {
    console.log('Start the bot with:');
    console.log('  mudpuppy telegram start');
  }
}

// Parse and execute command
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'init':
      await cmdInit();
      break;

    case 'config':
      const subCmd = args[1];
      if (subCmd === 'get') {
        cmdConfigGet(args[2]);
      } else if (subCmd === 'set') {
        if (!args[2] || args[3] === undefined) {
          console.error('Usage: mudpuppy config set <path> <value>');
          process.exit(1);
        }
        cmdConfigSet(args[2], args[3]);
      } else {
        console.error('Usage: mudpuppy config <get|set> ...');
        process.exit(1);
      }
      break;

    case 'status':
      cmdStatus();
      break;

    case 'version':
    case '--version':
    case '-v':
      printVersion();
      break;

    case 'help':
    case '--help':
    case '-h':
    case undefined:
      printHelp();
      break;

    case 'telegram':
      await cmdTelegram(args.slice(1));
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "mudpuppy help" for usage.');
      process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
