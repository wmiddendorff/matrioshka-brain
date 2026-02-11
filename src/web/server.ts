// Web management console server

import express, { type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { ConfigManager, resolvePath } from '../config.js';
import { SecretsManager } from '../secrets.js';
import { PluginManager } from '../plugins/index.js';
import { Scheduler } from '../scheduler/index.js';
import { executeTool } from '../tools/index.js';
import {
  PluginConfigRequestSchema,
  ScheduleUpdateRequestSchema,
  MemorySearchRequestSchema,
  SoulFileUpdateRequestSchema,
} from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create and configure Express app
 */
export function createApp(): express.Application {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.static(path.join(__dirname, 'public')));

  // CORS for localhost only
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // ============================================
  // System Status
  // ============================================

  app.get('/api/status', async (req, res) => {
    try {
      const config = new ConfigManager();
      const secrets = new SecretsManager();
      
      // Get Telegram status
      const { isDaemonRunning: isTelegramRunning } = await import('../telegram/index.js');
      
      // Get plugin status
      const pluginManager = new PluginManager(config.getValue('workspaceDir') as string);
      const plugins = await pluginManager.list();
      
      // Get scheduler status
      const scheduler = new Scheduler(config.getValue('workspaceDir') as string);
      const schedules = await scheduler.list();
      
      res.json({
        telegram: {
          running: isTelegramRunning(),
          configured: !!secrets.get('TELEGRAM_BOT_TOKEN'),
        },
        plugins: {
          installed: plugins.length,
          enabled: plugins.filter(p => p.enabled).length,
        },
        scheduler: {
          tasks: schedules.length,
          enabled: schedules.filter(s => s.enabled).length,
        },
        heartbeat: {
          enabled: config.getValue('heartbeat.enabled') as boolean || false,
          interval: config.getValue('heartbeat.interval') as number || 1800000,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================
  // Plugin Management
  // ============================================

  app.get('/api/plugins', async (req, res) => {
    try {
      const config = new ConfigManager();
      const pluginManager = new PluginManager(config.getValue('workspaceDir') as string);
      const plugins = await pluginManager.list();
      
      const pluginsWithStatus = await Promise.all(
        plugins.map(async (p) => {
          const status = await pluginManager.status(p.name);
          return {
            ...p,
            configured: status?.configured || false,
            errors: status?.errors,
          };
        })
      );
      
      res.json({ plugins: pluginsWithStatus });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get('/api/plugins/available', async (req, res) => {
    try {
      const config = new ConfigManager();
      const pluginManager = new PluginManager(config.getValue('workspaceDir') as string);
      const available = pluginManager.getAvailablePlugins();
      
      res.json({
        plugins: available.map(p => ({
          name: p.name,
          description: p.description,
          authType: p.authType,
          toolCount: p.registerTools().length,
        })),
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/plugins/:name/configure', async (req, res) => {
    try {
      const { name } = req.params;
      const { enabled, credentials } = PluginConfigRequestSchema.parse(req.body);
      
      const config = new ConfigManager();
      const pluginManager = new PluginManager(config.getValue('workspaceDir') as string);
      
      if (enabled !== undefined) {
        await pluginManager.update(name, { enabled });
      }
      
      if (credentials) {
        const plugin = pluginManager.getPlugin(name);
        if (plugin) {
          await plugin.setup(credentials);
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.delete('/api/plugins/:name', async (req, res) => {
    try {
      const { name } = req.params;
      const config = new ConfigManager();
      const pluginManager = new PluginManager(config.getValue('workspaceDir') as string);
      
      await pluginManager.remove(name);
      
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================
  // Schedule Management
  // ============================================

  app.get('/api/schedules', async (req, res) => {
    try {
      const config = new ConfigManager();
      const scheduler = new Scheduler(config.getValue('workspaceDir') as string);
      const schedules = await scheduler.list();
      
      res.json({ schedules });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.put('/api/schedules/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = ScheduleUpdateRequestSchema.parse(req.body);
      
      const config = new ConfigManager();
      const scheduler = new Scheduler(config.getValue('workspaceDir') as string);
      
      if (updates.enabled !== undefined) {
        await scheduler.toggle(id, updates.enabled);
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.delete('/api/schedules/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const config = new ConfigManager();
      const scheduler = new Scheduler(config.getValue('workspaceDir') as string);
      
      await scheduler.remove(id);
      
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================
  // Memory Browser
  // ============================================

  app.post('/api/memory/search', async (req, res) => {
    try {
      const { query, limit } = MemorySearchRequestSchema.parse(req.body);
      
      const result = await executeTool('memory_search', { query, limit });
      
      res.json(result);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get('/api/memory/stats', async (req, res) => {
    try {
      const result = await executeTool('memory_stats', {});
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.delete('/api/memory/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await executeTool('memory_delete', { id });
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================
  // Soul File Editor
  // ============================================

  app.get('/api/soul/:filename', (req, res) => {
    try {
      const { filename } = req.params;
      const validFiles = ['SOUL.md', 'IDENTITY.md', 'AGENTS.md', 'USER.md', 'HEARTBEAT.md'];
      
      if (!validFiles.includes(filename)) {
        res.status(400).json({ error: 'Invalid filename' });
        return;
      }
      
      const filePath = resolvePath(`workspace/${filename}`);
      
      if (!existsSync(filePath)) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      
      const content = readFileSync(filePath, 'utf-8');
      res.json({ filename, content });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.put('/api/soul/:filename', (req, res) => {
    try {
      const { filename } = req.params;
      const { content } = SoulFileUpdateRequestSchema.parse({ ...req.body, filename });
      
      const filePath = resolvePath(`workspace/${filename}`);
      writeFileSync(filePath, content, 'utf-8');
      
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================
  // Telegram Pairing Management
  // ============================================

  app.get('/api/telegram/status', async (req, res) => {
    try {
      const result = await executeTool('telegram_status', {});
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get('/api/telegram/pairs', async (req, res) => {
    try {
      const result = await executeTool('telegram_pair', { action: 'list' });
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/telegram/pairs/:userId/approve', async (req, res) => {
    try {
      const { userId } = req.params;
      await executeTool('telegram_pair', { action: 'approve', userId: parseInt(userId, 10) });
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/telegram/pairs/:userId/deny', async (req, res) => {
    try {
      const { userId } = req.params;
      await executeTool('telegram_pair', { action: 'deny', userId: parseInt(userId, 10) });
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================
  // Audit Log Viewer
  // ============================================

  app.get('/api/audit', (req, res) => {
    try {
      const logPath = resolvePath('data/audit.log');
      
      if (!existsSync(logPath)) {
        res.json({ logs: [] });
        return;
      }
      
      const content = readFileSync(logPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      // Parse last 100 lines
      const logs = lines.slice(-100).map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(Boolean);
      
      res.json({ logs: logs.reverse() });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return app;
}

/**
 * Start web server
 */
export async function startServer(port: number = 3456): Promise<void> {
  const app = createApp();

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`\n=== Matrioshka Brain Management Console ===`);
      console.log(`Server running at http://localhost:${port}`);
      console.log(`\nPress Ctrl+C to stop\n`);
      resolve();
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use`));
      } else {
        reject(err);
      }
    });
  });
}
