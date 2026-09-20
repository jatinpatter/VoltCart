import 'dotenv/config';
import mongoose from 'mongoose';
import { connectMongo } from './config/db.js';
import { connectRedis, redis, redisBlocking } from './config/redis.js';
import { syncSaleStatus } from './services/saleService.js';
import {
  startReservationSweeper,
  stopReservationSweeper,
} from './services/reservationSweeper.js';
import {
  startStreamConsumer,
  stopStreamConsumer,
} from './services/streamConsumer.js';
import {
  startReconciler,
  stopReconciler,
} from './services/reconciler.js';
import {
  startOrderSimulator,
  stopOrderSimulator,
} from './services/orderSimulator.js';

let saleTicker;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[worker] ${signal} received, shutting down...`);

  clearInterval(saleTicker);
  stopReservationSweeper();
  stopStreamConsumer();
  stopReconciler();
  stopOrderSimulator();

  await Promise.allSettled([
    mongoose.disconnect(),
    redis.quit(),
    redisBlocking.quit(),
  ]);

  process.exit(0);
}

async function main() {
  await connectMongo();
  await connectRedis();
  await syncSaleStatus();

  saleTicker = setInterval(() => {
    syncSaleStatus().catch((error) => {
      console.error('[sale]', error.message);
    });
  }, 1000);

  startReservationSweeper();
  await startStreamConsumer();
  startReconciler();
  startOrderSimulator();

  console.log('[worker] background jobs started');
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch((error) => {
  console.error('[worker] failed to start:', error);
  process.exit(1);
});
