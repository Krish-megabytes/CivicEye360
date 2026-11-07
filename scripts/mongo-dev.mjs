/**
 * Local development MongoDB.
 *
 * Uses a real MongoDB server binary (downloaded and cached by
 * mongodb-memory-server on first run) with an on-disk dbPath so data survives
 * restarts. This exists only so development does not require a system-wide
 * MongoDB install; production should point MONGODB_URI at a managed MongoDB.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';

const projectRoot = path.resolve(import.meta.dirname, '..');
const dbPath = path.join(projectRoot, '.data', 'mongo');
const logPath = path.join(projectRoot, '.data', 'mongo-dev.log');
fs.mkdirSync(dbPath, { recursive: true });

const port = Number(process.env.MONGO_DEV_PORT || 27017);

const binaryCandidates = [
  process.env.MONGOMS_SYSTEM_BINARY,
  path.join(projectRoot, '.data', 'mongodb', 'bin', 'mongod.exe'),
  path.join(projectRoot, '.data', 'mongodb', 'bin', 'mongod'),
].filter(Boolean);
const systemBinary = binaryCandidates.find((candidate) => fs.existsSync(candidate));

const portInUse = await new Promise((resolve) => {
  const socket = net.connect(port, '127.0.0.1');
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('error', () => resolve(false));
});

if (portInUse) {
  // A previous dev session (or a service install) already serves this port.
  // Reuse it and stay alive: `concurrently -k` would otherwise tear down the
  // API and web processes the moment this script exits.
  console.log(`[mongo] reusing MongoDB already listening at mongodb://127.0.0.1:${port}/civiceye360`);
  console.log(`[mongo] dbPath (if this instance owns it): ${dbPath}`);
  const keepAlive = setInterval(() => {}, 60_000);
  const stop = (signal) => {
    console.log(`[mongo] ${signal} received; leaving the existing MongoDB running`);
    clearInterval(keepAlive);
    process.exit(0);
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));
} else if (systemBinary) {

  // mongod writes its own startup log to logPath; keep stderr in a separate file so
  // Windows does not reject mongod opening a path this process already holds open.
  const errorLogPath = path.join(projectRoot, '.data', 'mongo-dev.stderr.log');
  const log = fs.createWriteStream(errorLogPath, { flags: 'a' });
  const child = spawn(
    systemBinary,
    ['--bind_ip', '127.0.0.1', '--port', String(port), '--dbpath', dbPath, '--logpath', logPath, '--logappend'],
    { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true, detached: process.platform === 'win32' },
  );
  child.stderr.pipe(log);
  child.once('error', (error) => {
    console.error(`[mongo] failed to start: ${error.message}`);
    process.exitCode = 1;
  });
  child.once('exit', (code, signal) => {
    if (!stopping && code !== 0) {
      console.error(`[mongo] exited unexpectedly (code=${code}, signal=${signal}); see ${logPath}`);
      process.exitCode = 1;
    }
  });

  let stopping = false;
  const waitForMongo = async () => {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`mongod exited with code ${child.exitCode}`);
      const reachable = await new Promise((resolve) => {
        const socket = net.connect(port, '127.0.0.1');
        socket.once('connect', () => { socket.destroy(); resolve(true); });
        socket.once('error', () => resolve(false));
      });
      if (reachable) return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`MongoDB did not listen on 127.0.0.1:${port} within 30 seconds`);
  };

  const shutdown = async (signal) => {
    stopping = true;
    console.log(`[mongo] ${signal} received, shutting down`);
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 5000))]);
    if (child.exitCode === null) child.kill('SIGKILL');
    log.end();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await waitForMongo();
  console.log(`[mongo] development MongoDB listening at mongodb://127.0.0.1:${port}/civiceye360`);
  console.log(`[mongo] dbPath: ${dbPath}`);
} else {
  const server = await MongoMemoryServer.create({
    instance: {
      port,
      dbName: 'civiceye360',
      dbPath,
      storageEngine: 'wiredTiger',
      ip: '127.0.0.1',
    },
    binary: { version: '7.0.14' },
  });

  console.log(`[mongo] development MongoDB listening at ${server.getUri('civiceye360')}`);
  console.log(`[mongo] dbPath: ${dbPath}`);

  async function shutdown(signal) {
    console.log(`[mongo] ${signal} received, shutting down`);
    await server.stop({ doCleanup: false, force: true }).catch(() => {});
    process.exit(0);
  }
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}
