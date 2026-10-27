import './env.js';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/api.js';
import Transaction from './models/Transaction.js';
import Budget from './models/Budget.js';
import Subscription from './models/Subscription.js';
import Goal from './models/Goal.js';
import { checkAndLogDueSubscriptions } from './services/subscriptionService.js';

const app = express();
const PORT = process.env.PORT || 5001;
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const MONGODB_URI = process.env.MONGODB_URI || (isServerless ? '' : 'mongodb://127.0.0.1:27017/expense_tracker');
const MONGODB_TIMEOUT_MS = Number.parseInt(process.env.MONGODB_TIMEOUT_MS || '5000', 10);

// Resolve paths for serving uploaded static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.disable('x-powered-by');
if (isServerless) app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  next();
});

// Flexible production CORS supporting Vercel previews & production domains
const allowedClientOrigins = new Set((process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => {
    try { return new URL(origin.trim()).origin; } catch { return null; }
  })
  .filter(Boolean));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, false);
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    return callback(null, allowedClientOrigins.has(origin));
  },
  credentials: false
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// Cached MongoDB connection helper for Serverless & Long-running servers
let isConnecting = false;
let areModelIndexesMigrated = false;
let modelIndexMigrationPromise = null;

async function ensureModelIndexes() {
  if (areModelIndexesMigrated) return;

  if (!modelIndexMigrationPromise) {
    modelIndexMigrationPromise = (async () => {
      await Promise.all([
        Budget.createIndexes(),
        Transaction.createIndexes(),
        Subscription.createIndexes(),
        Goal.createIndexes()
      ]);
      const indexes = await Budget.collection.indexes();
      const legacyIndex = indexes.find((index) =>
        index.name === 'category_1_month_1' && index.unique
      );
      if (legacyIndex) {
        await Budget.collection.dropIndex(legacyIndex.name);
      }
      areModelIndexesMigrated = true;
    })();
  }

  try {
    await modelIndexMigrationPromise;
  } catch (error) {
    modelIndexMigrationPromise = null;
    throw error;
  }
}

export async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    await ensureModelIndexes();
    return mongoose.connection;
  }
  if (!MONGODB_URI) return null;
  if (isConnecting) {
    // Wait for in-flight connection attempt
    while (isConnecting) {
      await new Promise(r => setTimeout(r, 100));
      if (mongoose.connection.readyState === 1) {
        await ensureModelIndexes();
        return mongoose.connection;
      }
    }
  }

  try {
    isConnecting = true;
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: MONGODB_TIMEOUT_MS,
      bufferCommands: false
    });
    await ensureModelIndexes();
    console.log('=== MongoDB Connected Successfully ===');
    return mongoose.connection;
  } catch (error) {
    console.warn('MongoDB Connection Warning:', error.message);
    return null;
  } finally {
    isConnecting = false;
  }
}

// Lazy connection middleware for serverless invocations
app.use(async (req, res, next) => {
  if (mongoose.connection.readyState !== 1 && MONGODB_URI) {
    try {
      await connectDB();
    } catch {
      // Continue, fallback mechanisms handle offline operations
    }
  }
  const isHealthCheck = req.path === '/health' || req.path === '/api/health';
  if (isServerless && !isHealthCheck && mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'The database is temporarily unavailable.' });
  }
  next();
});

// Root & API health check endpoints
app.get(['/health', '/api/health'], (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    serverless: Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME),
    mongodb: databaseConnected ? 'connected' : 'offline-fallback'
  });
});

// Mount API routes both under /api and / so rewrites match regardless of prefix
app.use('/api', apiRoutes);
app.use('/', apiRoutes);

// Static client files for standalone Node production server (Vercel serves client/dist directly)
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error handling middleware
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON request.' });
  }
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request payload is too large.' });
  }

  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Receipt images must be 10 MB or smaller.' });
  }
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: 'Invalid receipt upload.' });
  }

  if (error?.message?.includes('receipt images are allowed') || error?.message?.includes('images are allowed')) {
    return res.status(400).json({ error: 'Only supported receipt images are allowed.' });
  }

  console.error('Unhandled request error:', error);
  return res.status(500).json({ error: 'An unexpected server error occurred.' });
});

function validateProductionConfiguration() {
  if (process.env.NODE_ENV !== 'production') return;

  if (!process.env.JWT_SECRET && !process.env.AUTH_SECRET) {
    throw new Error('Production requires JWT_SECRET or AUTH_SECRET.');
  }
  if (!process.env.MONGODB_URI) throw new Error('Production requires MONGODB_URI.');
}

async function initializeDatabase() {
  console.log('Attempting to connect to MongoDB...');
  const conn = await connectDB();

  if (!conn) {
    console.log('Using Offline JSON DB fallback. Ensure MongoDB is running or MONGODB_URI is set.');
    try {
      const result = await checkAndLogDueSubscriptions(true);
      console.log(`=== Subscriptions scheduler (Offline JSON) logged ${result.loggedTransactionsCount} due entries ===`);
    } catch (schedulerError) {
      console.error('Offline subscription scheduler failed:', schedulerError.message);
    }
    return;
  }

  try {
    const result = await checkAndLogDueSubscriptions(false);
    console.log(`=== Subscriptions scheduler (MongoDB) logged ${result.loggedTransactionsCount} due entries ===`);
  } catch (error) {
    console.error('MongoDB subscription scheduler failed:', error.message);
  }
}

export async function startServer(port = PORT) {
  validateProductionConfiguration();
  await initializeDatabase();

  const server = app.listen(port);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ Error: Port ${port} is already in use by another process.`);
        console.error(`👉 Solution: Change PORT in server/.env (e.g. PORT=5002) or terminate the process on port ${port}.`);
        console.error(`   Windows: netstat -ano | findstr :${port}  ->  taskkill /PID <PID> /F\n`);
      }
      reject(err);
    });
  });
  console.log(`=== Server running on port ${port} ===`);
  console.log(`=== Health check at http://localhost:${port}/health ===`);
  return server;
}

export { app };

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer().catch((error) => {
    console.error('Unable to start server:', error.message);
    process.exitCode = 1;
  });
}
