import type { Server } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './lib/db.js';
import { logger } from './lib/logger.js';

let server: Server | undefined;
let shuttingDown = false;

async function start(): Promise<void> {
  await connectDatabase();
  const app = createApp();
  server = app.listen(env.port, env.host, () => {
    logger.info(
      {
        host: env.host,
        port: env.port,
        environment: env.nodeEnv,
        ai: env.openai.configured ? 'openai' : 'rules-fallback',
        email: env.smtp.configured ? 'configured' : 'not-configured',
      },
      'CivicEye 360 API listening',
    );
  });
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down');
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  await new Promise<void>((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    server.close(() => resolve());
  });
  await disconnectDatabase().catch(() => {});
  clearTimeout(force);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

start().catch((error) => {
  logger.error({ err: error }, 'Failed to start API server');
  process.exit(1);
});
