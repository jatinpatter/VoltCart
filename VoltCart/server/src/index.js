import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectMongo } from './config/db.js';
import { connectRedis, redis, redisBlocking } from './config/redis.js';

let server;
let shuttingDown = false;

async function closeServer() {
  if (!server) return;

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[api] ${signal} received, shutting down...`);

  await Promise.allSettled([
    closeServer(),
    mongoose.disconnect(),
    redis.quit(),
    redisBlocking.quit(),
  ]);

  process.exit(0);
}

async function main() {
  await connectMongo();
  await connectRedis();

  server = createApp().listen(env.port, () => {
    console.log(`[api] VoltCart server listening on port ${env.port}`);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch((error) => {
  console.error('[api] failed to start:', error);
  process.exit(1);
});
});
