import 'dotenv/config';
import { connectDB, pool } from './config/db.js';
import { connectConsumer, consumeEvents } from './kafka/consumer.js';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function processMedia(data) {
  const { fileKey } = data;

  const alreadyProcessed = await redis.get(fileKey);
  if (alreadyProcessed) {
    console.log(`Skipping duplicate: ${fileKey}`);
    return;
  }

  await redis.set(fileKey, 'processed', 'EX', 7200);

  console.log(`Processing: ${fileKey}`);
  await pool.query(`UPDATE media_files SET status = $1 WHERE file_url = $2`, ['processing', fileKey]);
  await new Promise(resolve => setTimeout(resolve, 2000));
  await pool.query(`UPDATE media_files SET status = $1 WHERE file_url = $2`, ['ready', fileKey]);
  console.log(`Done: ${fileKey}`);
}

async function start() {
  await connectDB();
  await connectConsumer();
  await consumeEvents(processMedia);
  console.log('Worker listening for media.uploaded events...');
}

start();
