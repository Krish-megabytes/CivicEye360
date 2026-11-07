import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const RETRY_WINDOW_MS = 60_000;
const RETRY_DELAY_MS = 1_000;

/**
 * Connects to MongoDB, waiting for the server to accept connections.
 *
 * In development MongoDB is started next to the API by the same `npm run dev`,
 * so the first connection attempt can lose the race against mongod booting.
 * Retrying briefly keeps the API from crash-looping on a cold start while
 * still failing loudly if the database never becomes reachable.
 */
export async function connectDatabase(uri = env.mongoUri): Promise<void> {
  mongoose.set('strictQuery', true);
  const deadline = Date.now() + RETRY_WINDOW_MS;
  for (let attempt = 1; ; attempt += 1) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5_000,
        autoIndex: !env.isProd,
      });
      const { host, name } = mongoose.connection;
      logger.info({ host, database: name }, 'MongoDB connected');
      return;
    } catch (error) {
      if (Date.now() + RETRY_DELAY_MS > deadline) throw error;
      logger.warn(
        { attempt, err: (error as Error).message },
        'MongoDB is not reachable yet; retrying',
      );
      await mongoose.disconnect().catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function databaseState(): 'connected' | 'connecting' | 'disconnected' | 'unknown' {
  const state = mongoose.connection.readyState;
  if (state === 1) return 'connected';
  if (state === 2) return 'connecting';
  if (state === 0) return 'disconnected';
  return 'unknown';
}
