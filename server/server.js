import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/api.js';
import { seedDatabase } from './services/seedService.js';
import { checkAndLogDueSubscriptions } from './services/subscriptionService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expense_tracker';
const MONGODB_TIMEOUT_MS = Number.parseInt(process.env.MONGODB_TIMEOUT_MS || '5000', 10);

// Resolve paths for serving uploaded static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.disable('x-powered-by');

// Flexible production CORS supporting Vercel previews & production domains
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || true,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cached MongoDB connection helper for Serverless & Long-running servers
let isConnecting = false;
export async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!MONGODB_URI) return null;
  if (isConnecting) {
    // Wait for in-flight connection attempt
    while (isConnecting) {
      await new Promise(r => setTimeout(r, 100));
      if (mongoose.connection.readyState === 1) return mongoose.connection;
    }
  }

  try {
    isConnecting = true;
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: MONGODB_TIMEOUT_MS,
      bufferCommands: false
    });
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
  next();
});

// Root & API health check endpoints
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    serverless: Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'offline-fallback'
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

  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Receipt images must be 10 MB or smaller.' });
  }

  if (error?.message?.includes('receipt images are allowed') || error?.message?.includes('images are allowed')) {
    return res.status(400).json({ error: error.message });
  }

  console.error('Unhandled request error:', error);
  return res.status(500).json({ error: 'An unexpected server error occurred.' });
});

function validateProductionConfiguration() {
  if (process.env.NODE_ENV !== 'production') return;

  if (!process.env.APP_PASSWORD && !process.env.AUTH_SECRET && !process.env.JWT_SECRET) {
    console.warn('Production Notice: APP_PASSWORD and AUTH_SECRET should be set in production for maximum security.');
  }
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

  if (process.env.NODE_ENV !== 'production') {
    await seedDatabase();
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
    server.once('error', reject);
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
