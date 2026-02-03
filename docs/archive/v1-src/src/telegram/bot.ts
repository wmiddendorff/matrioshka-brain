import { Bot, Context, session, SessionFlavor } from 'grammy';
import { ConfigManager } from '../config.js';
import { SecretsManager } from '../secrets.js';

/**
 * Telegram Bot Integration
 *
 * Handles all Telegram communication using grammY library.
 */

export interface BotSession {
  isPaired: boolean;
  pairRequestTime?: number;
}

type BotContext = Context & SessionFlavor<BotSession>;

export interface MessageHandler {
  (userId: number, text: string): Promise<string>;
}

export interface PairingApprovalHandler {
  (userId: number, username?: string): Promise<boolean>;
}

export class TelegramBot {
  private bot?: Bot<BotContext>;
  private config: ConfigManager;
  private secrets: SecretsManager;
  private running: boolean = false;
  private messageHandler?: MessageHandler;
  private pairingHandler?: PairingApprovalHandler;
  private startTime: number = 0;

  constructor(config: ConfigManager, secrets: SecretsManager) {
    this.config = config;
    this.secrets = secrets;
  }

  /**
   * Initialize the bot with token
   */
  private async initialize(): Promise<void> {
    const token = this.secrets.get('TELEGRAM_BOT_TOKEN');

    if (!token) {
      throw new Error(
        'Telegram bot token not found. Set it with: openclaw telegram set-token <token>'
      );
    }

    this.bot = new Bot<BotContext>(token);

    // Set up session middleware
    this.bot.use(session({
      initial: (): BotSession => ({ isPaired: false }),
    }));

    // Set up command handlers
    this.setupCommands();

    // Set up message handler
    this.setupMessageHandler();
  }

  /**
   * Set up bot commands
   */
  private setupCommands(): void {
    if (!this.bot) return;

    // /start command - initiate pairing
    this.bot.command('start', async (ctx) => {
      const userId = ctx.from?.id;
      const username = ctx.from?.username;

      if (!userId) {
        await ctx.reply('Error: Could not identify user');
        return;
      }

      // Check if already paired
      const pairedUsers = this.config.get().telegram.pairedUsers;
      if (pairedUsers.includes(userId)) {
        await ctx.reply('✅ You are already paired with this agent!');
        return;
      }

      // Check if pairing is pending
      if (ctx.session.isPaired) {
        await ctx.reply('⏳ Pairing request already pending...');
        return;
      }

      // Request approval from local user
      await ctx.reply('⏳ Pairing request sent. Waiting for approval on the local machine...');

      // Call pairing approval handler
      if (this.pairingHandler) {
        const approved = await this.pairingHandler(userId, username);

        if (approved) {
          // Add to paired users
          const cfg = this.config.get();
          cfg.telegram.pairedUsers.push(userId);
          this.config.set('telegram.pairedUsers', cfg.telegram.pairedUsers);
          this.config.save();

          ctx.session.isPaired = true;
          await ctx.reply('✅ Pairing approved! You can now chat with the agent.');
        } else {
          await ctx.reply('❌ Pairing was denied.');
        }
      } else {
        await ctx.reply('❌ No pairing handler configured');
      }
    });

    // /status command - show bot status
    this.bot.command('status', async (ctx) => {
      const userId = ctx.from?.id;

      if (!userId) {
        await ctx.reply('Error: Could not identify user');
        return;
      }

      // Check if paired
      const pairedUsers = this.config.get().telegram.pairedUsers;
      if (!pairedUsers.includes(userId)) {
        await ctx.reply('❌ You are not paired. Send /start to begin pairing.');
        return;
      }

      const uptime = this.getUptime();
      const pairedCount = pairedUsers.length;

      await ctx.reply(
        `🤖 <b>Bot Status</b>\n\n` +
        `✅ Online\n` +
        `⏱ Uptime: ${uptime}\n` +
        `👥 Paired users: ${pairedCount}`,
        { parse_mode: 'HTML' }
      );
    });

    // /help command
    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        `<b>Available Commands:</b>\n\n` +
        `/start - Pair with the agent\n` +
        `/status - Check bot status\n` +
        `/help - Show this help message\n\n` +
        `Send any message to chat with the agent.`,
        { parse_mode: 'HTML' }
      );
    });
  }

  /**
   * Set up message handler for regular messages
   */
  private setupMessageHandler(): void {
    if (!this.bot) return;

    this.bot.on('message:text', async (ctx) => {
      const userId = ctx.from?.id;
      const text = ctx.message.text;

      if (!userId || !text) return;

      // Skip if it's a command
      if (text.startsWith('/')) return;

      // Check if user is paired
      const pairedUsers = this.config.get().telegram.pairedUsers;
      if (!pairedUsers.includes(userId)) {
        await ctx.reply('❌ You are not paired. Send /start to begin pairing.');
        return;
      }

      // Handle message
      if (this.messageHandler) {
        try {
          const response = await this.messageHandler(userId, text);
          await ctx.reply(response, { parse_mode: 'HTML' });
        } catch (error) {
          console.error('Error handling message:', error);
          await ctx.reply('❌ Error processing your message. Please try again.');
        }
      } else {
        await ctx.reply('🤖 Agent is not configured to handle messages yet.');
      }
    });
  }

  /**
   * Start the bot
   */
  public async start(): Promise<void> {
    if (this.running) {
      throw new Error('Bot is already running');
    }

    if (!this.config.get().telegram.enabled) {
      throw new Error('Telegram is not enabled in configuration');
    }

    await this.initialize();

    if (!this.bot) {
      throw new Error('Bot initialization failed');
    }

    console.log('🤖 Starting Telegram bot...');

    this.startTime = Date.now();
    this.running = true;

    // Start polling
    this.bot.start({
      onStart: (botInfo) => {
        console.log(`✅ Bot started: @${botInfo.username}`);
      },
    });
  }

  /**
   * Stop the bot
   */
  public async stop(): Promise<void> {
    if (!this.running || !this.bot) {
      return;
    }

    console.log('🛑 Stopping Telegram bot...');
    await this.bot.stop();
    this.running = false;
    console.log('✅ Bot stopped');
  }

  /**
   * Send a message to a paired user
   */
  public async sendMessage(userId: number, text: string): Promise<void> {
    if (!this.bot || !this.running) {
      throw new Error('Bot is not running');
    }

    const pairedUsers = this.config.get().telegram.pairedUsers;
    if (!pairedUsers.includes(userId)) {
      throw new Error(`User ${userId} is not paired`);
    }

    await this.bot.api.sendMessage(userId, text, { parse_mode: 'HTML' });
  }

  /**
   * Send a notification to all paired users
   */
  public async sendNotification(text: string): Promise<void> {
    const pairedUsers = this.config.get().telegram.pairedUsers;

    for (const userId of pairedUsers) {
      try {
        await this.sendMessage(userId, text);
      } catch (error) {
        console.error(`Failed to send notification to ${userId}:`, error);
      }
    }
  }

  /**
   * Set message handler
   */
  public setMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  /**
   * Set pairing approval handler
   */
  public setPairingHandler(handler: PairingApprovalHandler): void {
    this.pairingHandler = handler;
  }

  /**
   * Get bot uptime in human-readable format
   */
  private getUptime(): string {
    if (!this.running) return 'Not running';

    const seconds = Math.floor((Date.now() - this.startTime) / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Check if bot is running
   */
  public isRunning(): boolean {
    return this.running;
  }
}
