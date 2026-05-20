import 'dotenv/config';
import { connectDB, pool } from './config/db.js';
import { connectConsumer, consumeEvents } from './kafka/consumer.js';

async function processMedia(data) {
  const { fileKey } = data;
  console.log(`Processing: ${fileKey}`);

  await pool.query(`update media_files set status = $1 where file_url = $2`,['processing', fileKey]);
  await new Promise(resolve => setTimeout(resolve, 2000))
  await pool.query(`update media_files set status = $1 where file_url = $2`,['ready', fileKey]);
}

async function start() {
  await connectDB();
  await connectConsumer();
  await consumeEvents(processMedia);
  console.log('Worker listening for media.uploaded events...');
}

start();
