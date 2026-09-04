import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/api.js';
import { seedDatabase } from './services/seedService.js';
import { checkAndLogDueSubscriptions } from './services/subscriptionService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Resolve paths for serving uploaded static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded receipts statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount API routes
app.use('/api', apiRoutes);

// Root health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expense_tracker';

console.log('Attempting to connect to MongoDB...');
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('=== MongoDB Connected Successfully ===');
    seedDatabase();
    checkAndLogDueSubscriptions(false)
      .then(res => console.log(`=== Subscriptions scheduler (MongoDB) logged ${res.loggedTransactionsCount} due entries ===`))
      .catch(err => console.error(err));
  })
  .catch((err) => {
    console.error('!!! MongoDB Connection Error !!!');
    console.error(err.message);
    console.log('Please ensure MongoDB is installed and running locally, or configure MONGODB_URI in server/.env');
    // Fallback scheduler check on JSON DB
    checkAndLogDueSubscriptions(true)
      .then(res => console.log(`=== Subscriptions scheduler (Offline JSON) logged ${res.loggedTransactionsCount} due entries ===`))
      .catch(e => console.error(e));
  });

// Start Express server
app.listen(PORT, () => {
  console.log(`=== Server running on port ${PORT} ===`);
  console.log(`=== Health check at http://localhost:${PORT}/health ===`);
});
