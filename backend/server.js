import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import prisma from './lib/prisma.js';
import { getAllowedOrigins, validateEnvironment } from './config/env.js';
import authRoutes from './routes/auth.js';
import bookRoutes from './routes/books.js';
import analyticsRoutes from './routes/analytics.js';
import readingSessionRoutes from './routes/readingSessions.js';
import collectionRoutes from './routes/collections.js';
import aiRoutes from './routes/ai.js';

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = getAllowedOrigins();

app.disable('x-powered-by');
if (isProduction) app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin.replace(/\/$/, ''))) {
      return callback(null, true);
    }
    return callback(Object.assign(new Error('Origin is not allowed'), { status: 403 }));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}));
app.use(express.json({ limit: '100kb', strict: true }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many authentication attempts. Please try again later.' }
});
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'AI request limit reached. Please try again later.' }
});

app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/ai', aiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reading-sessions', readingSessionRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/ai', aiRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready' });
  } catch (error) {
    console.error('Readiness check failed:', error.message);
    res.status(503).json({ status: 'unavailable' });
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, _req, res, _next) => {
  const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500) console.error('Unhandled request error:', err);
  res.status(status).json({
    error: status === 400 ? 'Invalid JSON request body'
      : status === 403 ? 'Origin is not allowed'
        : status === 413 ? 'Request body is too large'
          : 'Internal server error'
  });
});

let server;
let shuttingDown = false;

async function startServer() {
  const { port } = validateEnvironment();
  await prisma.$connect();

  server = app.listen(port, () => {
    console.log(`ReadingHub API listening on port ${port} (${process.env.NODE_ENV || 'development'})`);
  });

  server.on('error', (error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}

async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; shutting down`);

  const forceExit = setTimeout(() => {
    console.error('Graceful shutdown timed out');
    process.exit(1);
  }, 10000);
  forceExit.unref();

  if (server) await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
  clearTimeout(forceExit);
  process.exit(0);
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

startServer().catch(async (error) => {
  console.error('Failed to start server:', error.message);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});

export default app;
