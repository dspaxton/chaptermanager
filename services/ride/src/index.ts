import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Pool } from 'pg';
import { createClient } from 'redis';
import { rideRouter } from './routes/rides';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

const app = express();
const PORT = process.env.PORT || 4003;

export const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

export const redis = createClient({
  url: `redis://:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
});

async function initializeConnections() {
  try {
    const client = await pool.connect();
    logger.info('Connected to PostgreSQL');
    client.release();

    await redis.connect();
    logger.info('Connected to Redis');
  } catch (error) {
    logger.error('Failed to initialize connections:', error);
    process.exit(1);
  }
}

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/api/rides/health', (req, res) => {
  res.json({ status: 'healthy', service: 'ride-service' });
});

app.use('/api/rides', rideRouter);

app.use(errorHandler);

async function start() {
  await initializeConnections();

  app.listen(PORT, () => {
    logger.info(`Ride service running on port ${PORT}`);
  });
}

start().catch((error) => {
  logger.error('Failed to start ride service:', error);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await redis.quit();
  await pool.end();
  process.exit(0);
});
