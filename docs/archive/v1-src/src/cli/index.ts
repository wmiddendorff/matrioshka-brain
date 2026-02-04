#!/usr/bin/env node

import { ConfigManager } from '../config.js';
import { SecretsManager } from '../secrets.js';
import { TelegramBot } from '../telegram/index.js';
import { ApprovalManager } from '../security/index.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get version from package.json
function getVersion(): string {
  try {
    const packagePath = join(__dirname, '../../package.json');
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
    return pkg.version || '0.1.0';
  } catch {
    return '0.1.0';
  }
}

function showHelp(): void {
  console.log(`
MatrioshkaBrain v${getVersion()} 🧠
Security-hardened autonomous AI agent extending Claude Code

Usage:
  matrioshka-brain [command] [options]

Commands:
  init                  Initialize agent workspace
  start                 Start the Telegram bot
  stop                  Stop the Telegram bot
  status                Show bot status
  config get            Show current configuration
  config set <key> <value>  Set configuration value

  Telegram Commands:
  telegram set-token <token>  Set Telegram bot token
  telegram enable             Enable Telegram integration
  telegram disable            Disable Telegram integration

  Future Commands (not yet implemented):
  memory search <q>     Search memories
  memory add <text>     Add memory entry
  heartbeat pause       Pause heartbeat
  heartbeat resume      Resume heartbeat
  audit [--tail]        Show audit log

Options:
  --version, -v       Show version
  --help, -h          Show this help

Examples:
  matrioshka-brain init
  matrioshka-brain telegram set-token 123456:ABC-DEF...
  matrioshka-brain telegram enable
  matrioshka-brain config set telegram.enabled true
  matrioshka-brain start
  matrioshka-brain --version
`);
}

async function main() {
  const args = process.argv.slice(2);

  // Handle no arguments
  if (args.length === 0) {
    showHelp();
    process.exit(0);
  }

  const command = args[0];

  // Handle version flag
  if (command === '--version' || command === '-v') {
    console.log(`matrioshka-brain v${getVersion()} 🧠`);
    process.exit(0);
  }

  // Handle help flag
  if (command === '--help' || command === '-h') {
    showHelp();
    process.exit(0);
  }

  const config = new ConfigManager();

  switch (command) {
    case 'init': {
      console.log('Initializing MatrioshkaBrain workspace... 🧠');
      config.ensureWorkspace();
      config.save();
      console.log(`✓ Workspace created at: ${config.get().workspace}`);
      console.log('✓ Configuration saved');
      console.log('\nNext steps:');
      console.log('  1. Configure Telegram bot token (Phase 1)');
      console.log('  2. Run: matrioshka-brain start');
      break;
    }

    case 'config': {
      const subcommand = args[1];

      if (subcommand === 'get') {
        console.log(JSON.stringify(config.get(), null, 2));
      } else if (subcommand === 'set') {
        const key = args[2];
        const value = args[3];

        if (!key || !value) {
          console.error('Error: config set requires <key> and <value>');
          process.exit(1);
        }

        // Parse value (handle booleans, numbers, JSON)
        let parsedValue: any = value;
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (!isNaN(Number(value))) parsedValue = Number(value);
        else if (value.startsWith('{') || value.startsWith('[')) {
          try {
            parsedValue = JSON.parse(value);
          } catch {
            // Keep as string if JSON parse fails
          }
        }

        config.set(key, parsedValue);
        config.save();
        console.log(`✓ Set ${key} = ${parsedValue}`);
      } else {
        console.error('Error: Unknown config subcommand. Use "get" or "set"');
        process.exit(1);
      }
      break;
    }

    case 'telegram': {
      const subcommand = args[1];
      const secrets = new SecretsManager();

      if (subcommand === 'set-token') {
        const token = args[2];
        if (!token) {
          console.error('Error: telegram set-token requires <token>');
          process.exit(1);
        }

        secrets.set('TELEGRAM_BOT_TOKEN', token);
        secrets.save();
        console.log(`✓ Telegram bot token saved to ${secrets.getPath()}`);
        console.log('  Next: matrioshka-brain telegram enable');
      } else if (subcommand === 'enable') {
        config.set('telegram.enabled', true);
        config.save();
        console.log('✓ Telegram integration enabled');
        console.log('  Next: matrioshka-brain start');
      } else if (subcommand === 'disable') {
        config.set('telegram.enabled', false);
        config.save();
        console.log('✓ Telegram integration disabled');
      } else {
        console.error('Error: Unknown telegram subcommand. Use "set-token", "enable", or "disable"');
        process.exit(1);
      }
      break;
    }

    case 'start': {
      const secrets = new SecretsManager();
      const approval = new ApprovalManager();

      // Check if Telegram is enabled
      if (!config.get().telegram.enabled) {
        console.error('Error: Telegram is not enabled');
        console.log('Run: matrioshka-brain telegram enable');
        process.exit(1);
      }

      // Check if bot token exists
      if (!secrets.has('TELEGRAM_BOT_TOKEN')) {
        console.error('Error: Telegram bot token not set');
        console.log('Run: matrioshka-brain telegram set-token <token>');
        process.exit(1);
      }

      console.log('Starting MatrioshkaBrain... 🧠\n');

      // Create and start bot
      const bot = new TelegramBot(config, secrets);

      // Set up pairing handler
      bot.setPairingHandler(async (userId, username) => {
        const approved = await approval.requestApproval({
          title: 'Telegram Pairing Request',
          description: 'A user wants to pair with this agent',
          details: {
            'User ID': userId.toString(),
            'Username': username ? `@${username}` : '(not set)',
          },
        });

        return approved;
      });

      // Set up message handler (simple echo for now)
      bot.setMessageHandler(async (userId, text) => {
        console.log(`📨 Message from ${userId}: ${text}`);
        // For now, just echo back
        return `🤖 Echo: ${text}`;
      });

      // Start bot
      try {
        await bot.start();

        console.log('\n✅ Bot is running. Press Ctrl+C to stop.\n');

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
          console.log('\n🛑 Shutting down...');
          await bot.stop();
          approval.close();
          process.exit(0);
        });

        process.on('SIGTERM', async () => {
          await bot.stop();
          approval.close();
          process.exit(0);
        });

        // Keep process alive
        await new Promise(() => {});
      } catch (error) {
        console.error('Error starting bot:', error);
        approval.close();
        process.exit(1);
      }
      break;
    }

    case 'stop': {
      console.log('To stop the bot, press Ctrl+C in the terminal where it is running');
      break;
    }

    case 'status': {
      const secrets = new SecretsManager();

      console.log('\n📊 MatrioshkaBrain Status 🧠\n');
      console.log(`Version: ${getVersion()}`);
      console.log(`Workspace: ${config.get().workspace}`);
      console.log(`\nTelegram:`);
      console.log(`  Enabled: ${config.get().telegram.enabled ? '✅' : '❌'}`);
      console.log(`  Token set: ${secrets.has('TELEGRAM_BOT_TOKEN') ? '✅' : '❌'}`);
      console.log(`  Paired users: ${config.get().telegram.pairedUsers.length}`);
      console.log(`\nMemory:`);
      console.log(`  Enabled: ${config.get().memory.enabled ? '✅' : '❌'} (Phase 3)`);
      console.log(`\nHeartbeat:`);
      console.log(`  Enabled: ${config.get().heartbeat.enabled ? '✅' : '❌'} (Phase 4)`);
      console.log('');
      break;
    }

    case 'memory':
    case 'heartbeat':
    case 'audit': {
      console.log(`Command "${command}" not yet implemented (will be added in later phases)`);
      break;
    }

    default: {
      console.error(`Error: Unknown command "${command}"`);
      console.log('Run "matrioshka-brain --help" for usage information');
      process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
