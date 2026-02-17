#!/usr/bin/env node
/**
 * Web server runner (for daemon mode)
 */

import { startServer } from './server.js';
import { writePid, removePid } from './daemon.js';

const port = parseInt(process.argv[2] || '3456', 10);

writePid(process.pid);

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...');
  removePid();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down...');
  removePid();
  process.exit(0);
});

startServer(port).catch((error: Error) => {
  console.error('Failed to start web server:', error);
  removePid();
  process.exit(1);
});
