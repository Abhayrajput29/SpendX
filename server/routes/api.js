import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import Budget from '../models/Budget.js';
import { autoCategorize, getFinancialAdvisorInsights } from '../services/aiService.js';
import { scanReceipt } from '../services/ocrService.js';
import { jsonDb } from '../services/jsonDbService.js';
import { generateForecast } from '../services/forecastService.js';
import Subscription from '../models/Subscription.js';
import Goal from '../models/Goal.js';
import { detectRecurringPayments, checkAndLogDueSubscriptions } from '../services/subscriptionService.js';
import { authenticate, authRateLimit, login, register, getCurrentUser, validateUsername, validateEmail } from '../middleware/auth.js';

const router = express.Router();

router.post('/auth/register', authRateLimit, register);
router.post('/auth/login', authRateLimit, login);
router.post('/auth/validate-username', authRateLimit, validateUsername);
router.post('/auth/validate-email', authRateLimit, validateEmail);

function hasValidCronSecret(req) {
  const expected = process.env.CRON_SECRET;
  const authorization = req.headers.authorization || '';
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

// Vercel Cron sends GET and authenticates with the configured CRON_SECRET.
router.get('/subscriptions/run-scheduler', async (req, res) => {
  if (!hasValidCronSecret(req)) return res.status(401).json({ error: 'Unauthorized scheduler request' });
  try {
    const result = await checkAndLogDueSubscriptions(mongoose.connection.readyState !== 1);
    return res.json(result);
  } catch (error) {
    console.error('Scheduled subscription run failed:', error.message);
    return res.status(500).json({ error: 'Scheduled subscription processing failed.' });
  }
});

router.use(authenticate);
router.get('/auth/me', getCurrentUser);

router.use((req, res, next) => {
  const monthValues = [req.query.month, req.body?.month];
  if (monthValues.some((month) => month !== undefined && (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)))) {
    return res.status(400).json({ error: 'Month must use YYYY-MM format' });
  }
  const amountValues = [req.body?.amount, req.body?.limit];
  if (amountValues.some((amount) => amount !== undefined && (!['number', 'string'].includes(typeof amount) || !Number.isFinite(Number(amount)) || Number(amount) <= 0))) {
    return res.status(400).json({ error: 'Amounts must be positive finite numbers' });
  }
  if (req.query.search !== undefined && (typeof req.query.search !== 'string' || req.query.search.length > 100)) {
    return res.status(400).json({ error: 'Search text is too long' });
  }
  if (req.query.category !== undefined && (typeof req.query.category !== 'string' || req.query.category.length > 80)) {
    return res.status(400).json({ error: 'Category filter is invalid' });
  }
  next();
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sendApiError(res, error) {
  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid request data.' });
  }
  console.error('API handler failed:', error);
  return res.status(500).json({ error: 'An internal server error occurred.' });
}

function ownedQuery(req, query = {}) {
  return { ...query, userId: req.userId };
}

function getMonthRange(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    start: new Date(Date.UTC(year, monthNumber - 1, 1)),
    end: new Date(Date.UTC(year, monthNumber, 1))
  };
}

const TRANSACTION_UPDATE_FIELDS = new Set(['description', 'amount', 'date', 'paymentMethod', 'category', 'merchant', 'tags', 'notes', 'receiptUrl']);
const SUBSCRIPTION_UPDATE_FIELDS = new Set(['description', 'amount', 'category', 'merchant', 'billingCycle', 'nextDueDate', 'status', 'paymentMethod', 'isEMI', 'tenureMonths', 'remainingMonths']);
const GOAL_UPDATE_FIELDS = new Set(['name', 'targetAmount', 'currentAmount', 'targetDate', 'frequency', 'contributionAmount', 'category', 'color', 'notes']);

function ownedUpdates(updates, allowedFields) {
  const safeUpdates = {};
  for (const [key, value] of Object.entries(updates || {})) {
    if (!allowedFields.has(key) || key.includes('.') || key.includes('$') || ['_id', 'userId', '__proto__', 'constructor', 'prototype'].includes(key)) continue;
    safeUpdates[key] = value;
  }
  return safeUpdates;
}

function validateSubscriptionPayload(payload, allowPartial = false) {
  const has = (key) => Object.prototype.hasOwnProperty.call(payload, key);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'Subscription data is invalid.';
  if (!allowPartial && (typeof payload.description !== 'string' || !payload.description.trim() || payload.description.length > 120 || !['number', 'string'].includes(typeof payload.amount) || !Number.isFinite(Number(payload.amount)) || Number(payload.amount) <= 0)) {
    return 'Subscription description and a positive finite amount are required.';
  }
  if (has('description') && (typeof payload.description !== 'string' || !payload.description.trim() || payload.description.length > 120)) return 'Subscription description is invalid.';
  if (has('amount') && (!['number', 'string'].includes(typeof payload.amount) || !Number.isFinite(Number(payload.amount)) || Number(payload.amount) <= 0)) return 'Subscription amount must be a positive finite number.';
  if (has('billingCycle') && !['weekly', 'monthly', 'yearly'].includes(payload.billingCycle)) return 'Subscription billing cycle is invalid.';
  if (has('nextDueDate') && (typeof payload.nextDueDate !== 'string' || !Number.isFinite(Date.parse(payload.nextDueDate)))) return 'Subscription due date is invalid.';
  if (has('status') && !['active', 'paused', 'cancelled', 'completed'].includes(payload.status)) return 'Subscription status is invalid.';
  if (has('paymentMethod') && !['Cash', 'Card', 'UPI', 'NetBanking', 'Other'].includes(payload.paymentMethod)) return 'Subscription payment method is invalid.';
  if (has('category') && (typeof payload.category !== 'string' || payload.category.length > 80)) return 'Subscription category is invalid.';
  if (has('merchant') && (typeof payload.merchant !== 'string' || payload.merchant.length > 120)) return 'Subscription merchant is invalid.';
  if (has('isEMI') && typeof payload.isEMI !== 'boolean' && !['true', 'false'].includes(payload.isEMI)) return 'Subscription EMI flag is invalid.';
  for (const field of ['tenureMonths', 'remainingMonths']) {
    if (!has(field) || payload[field] === null) continue;
    const value = Number(payload[field]);
    if (!Number.isSafeInteger(value) || value < (field === 'tenureMonths' ? 1 : 0) || value > 1200) return 'EMI months must be whole numbers between 0 and 1,200.';
  }
  if (payload.tenureMonths != null && payload.remainingMonths != null && Number(payload.remainingMonths) > Number(payload.tenureMonths)) return 'Remaining EMI months cannot exceed the total tenure.';
  if (allowPartial && Object.keys(payload).length === 0) return 'At least one editable subscription field is required.';
  return null;
}

function validateTransactionPayload(payload, allowPartial = false) {
  const has = (key) => Object.prototype.hasOwnProperty.call(payload, key);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'Transaction data is invalid.';
  if (!allowPartial && (typeof payload.description !== 'string' || !payload.description.trim() || payload.description.length > 500 || !['number', 'string'].includes(typeof payload.amount) || !Number.isFinite(Number(payload.amount)) || Number(payload.amount) <= 0)) {
    return 'Transaction description and a positive finite amount are required.';
  }
  if (has('description') && (typeof payload.description !== 'string' || !payload.description.trim() || payload.description.length > 500)) return 'Transaction description is invalid.';
  if (has('amount') && (!['number', 'string'].includes(typeof payload.amount) || !Number.isFinite(Number(payload.amount)) || Number(payload.amount) <= 0)) return 'Transaction amount must be a positive finite number.';
  if (has('date') && (typeof payload.date !== 'string' || !Number.isFinite(Date.parse(payload.date)))) return 'Transaction date is invalid.';
  if (has('paymentMethod') && !['Cash', 'Card', 'UPI', 'NetBanking', 'Other'].includes(payload.paymentMethod)) return 'Transaction payment method is invalid.';
  if (has('category') && (typeof payload.category !== 'string' || payload.category.length > 80)) return 'Transaction category is invalid.';
  if (has('merchant') && (typeof payload.merchant !== 'string' || payload.merchant.length > 120)) return 'Transaction merchant is invalid.';
  if (has('notes') && (typeof payload.notes !== 'string' || payload.notes.length > 5000)) return 'Transaction notes are invalid.';
  if (has('tags') && (!Array.isArray(payload.tags) || payload.tags.length > 50 || payload.tags.some((tag) => typeof tag !== 'string' || tag.length > 80))) return 'Transaction tags are invalid.';
  if (has('receiptUrl') && (typeof payload.receiptUrl !== 'string' || (payload.receiptUrl !== '' && (!payload.receiptUrl.startsWith('/api/uploads/') || payload.receiptUrl.includes('..') || payload.receiptUrl.includes('\\'))))) return 'Receipt URL must be a local SpendX upload.';
  if (allowPartial && Object.keys(payload).length === 0) return 'At least one editable transaction field is required.';
  return null;
}

function receiptOwnerPrefix(userId) {
  return createHash('sha256').update(userId).digest('hex');
}

const RECEIPT_MIME_BY_EXTENSION = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif']
]);

function getReceiptImageMime(filePath) {
  const header = Buffer.alloc(64);
  let fd;
  let bytesRead;
  try {
    fd = fs.openSync(filePath, 'r');
    bytesRead = fs.readSync(fd, header, 0, header.length, 0);
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }

  const bytes = header.subarray(0, bytesRead);
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (bytes.length >= 16 && bytes.toString('ascii', 4, 8) === 'ftyp') {
    const brands = [bytes.toString('ascii', 8, 12)];
    for (let offset = 16; offset + 4 <= bytes.length; offset += 4) brands.push(bytes.toString('ascii', offset, offset + 4));
    if (brands.some((brand) => brand === 'avif' || brand === 'avis')) return 'image/avif';
  }
  return null;
}

// Setup Multer for receipt uploads (safe for both local filesystem and serverless /tmp)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const uploadsDir = isServerless ? path.join(os.tmpdir(), 'spendx_uploads') : path.join(__dirname, '../uploads');

if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (err) {
    console.warn('Notice: Could not pre-create uploads directory:', err.message);
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = randomUUID();
    cb(null, `${receiptOwnerPrefix(req.userId)}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const expectedMime = RECEIPT_MIME_BY_EXTENSION.get(path.extname(file.originalname).toLowerCase());
    if (expectedMime && (!file.mimetype || file.mimetype === 'application/octet-stream' || file.mimetype === expectedMime)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, JPEG, PNG, WEBP, and AVIF receipt images are allowed.'));
    }
  }
});

// --- TRANSACTIONS API ---

// Get all transactions with search, filter, and pagination
router.get('/transactions', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const transactions = await jsonDb.getTransactions(req.userId, req.query);
      return res.json(transactions);
    }
    const { category, search, month, sortBy } = req.query;
    const query = ownedQuery(req);

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { description: { $regex: escapeRegex(search), $options: 'i' } },
        { merchant: { $regex: escapeRegex(search), $options: 'i' } },
        { notes: { $regex: escapeRegex(search), $options: 'i' } }
      ];
    }

    if (month) {
      const { start, end } = getMonthRange(month);
      query.date = { $gte: start, $lt: end };
    }

    const sortOptions = {
      createdAt: { createdAt: -1 },
      dateAsc: { date: 1 },
      amountDesc: { amount: -1 },
      amountAsc: { amount: 1 }
    };
    const sortObj = sortOptions[sortBy] || { date: -1 };
    const transactions = await Transaction.find(query).sort(sortObj);
    res.json(transactions);
  } catch (error) {
    return sendApiError(res, error);
  }
});

// Create a new transaction
router.post('/transactions', async (req, res) => {
  try {
    const validationError = validateTransactionPayload(req.body);
    if (validationError) return res.status(400).json({ error: validationError });
    if (mongoose.connection.readyState !== 1) {
      const transaction = await jsonDb.createTransaction(req.userId, req.body);
      return res.status(201).json(transaction);
    }
    const { description, amount, date, paymentMethod, merchant, tags, notes, category, receiptUrl } = req.body;

    let finalCategory = category;
    let isAuto = false;
    let aiResult = null;

    // If category is default/not provided, run autoCategorize once
    if (!finalCategory || finalCategory === 'Other' || finalCategory === 'Miscellaneous') {
      aiResult = await autoCategorize(description);
      finalCategory = aiResult.category;
      isAuto = true;
    }

    // Deduce merchant if empty — reuse the same AI result if already fetched
    let finalMerchant = merchant;
    if (!finalMerchant) {
      if (!aiResult) aiResult = await autoCategorize(description);
      finalMerchant = aiResult.merchant;
    }

    const transaction = new Transaction({
      userId: req.userId,
      description,
      amount,
      date: date || new Date(),
      paymentMethod: paymentMethod || 'Cash',
      category: finalCategory,
      merchant: finalMerchant,
      receiptUrl: receiptUrl || '',
      tags: tags || [],
      notes: notes || '',
      isAutoCategorized: isAuto
    });

    await transaction.save();
    res.status(201).json(transaction);
  } catch (error) {
    return sendApiError(res, error);
  }
});

// Update a transaction
router.put('/transactions/:id', async (req, res) => {
  try {
    const updates = ownedUpdates(req.body, TRANSACTION_UPDATE_FIELDS);
    const validationError = validateTransactionPayload(updates, true);
    if (validationError) return res.status(400).json({ error: validationError });
    if (mongoose.connection.readyState !== 1) {
      const transaction = await jsonDb.updateTransaction(req.userId, req.params.id, updates);
      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      return res.json(transaction);
    }
    const transaction = await Transaction.findOneAndUpdate(
      ownedQuery(req, { _id: req.params.id }),
      updates,
      { new: true, runValidators: true }
    );
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json(transaction);
  } catch (error) {
    return sendApiError(res, error);
  }
});

// Delete a transaction
router.delete('/transactions/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const result = await jsonDb.deleteTransaction(req.userId, req.params.id);
      if (!result) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      return res.json({ message: 'Transaction deleted successfully' });
    }
    const transaction = await Transaction.findOneAndDelete(ownedQuery(req, { _id: req.params.id }));
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    return sendApiError(res, error);
  }
});

// --- BUDGETS API ---

// Get all budgets for a specific month (YYYY-MM)
router.get('/budgets', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) {
      return res.status(400).json({ error: 'Month query parameter is required (YYYY-MM)' });
    }
    if (mongoose.connection.readyState !== 1) {
      const budgets = await jsonDb.getBudgets(req.userId, month);
      return res.json(budgets);
    }
    const budgets = await Budget.find(ownedQuery(req, { month }));
    res.json(budgets);
  } catch (error) {
    return sendApiError(res, error);
  }
});

// Create or update a budget limit
router.post('/budgets', async (req, res) => {
  try {
    const { category, limit, month } = req.body;
    if (typeof category !== 'string' || !category.trim() || category.length > 80 || !['number', 'string'].includes(typeof limit) || !Number.isFinite(Number(limit)) || Number(limit) <= 0 || typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res.status(400).json({ error: 'category, limit, and month are required' });
    }
    const normalizedCategory = category.trim();
    const normalizedLimit = Number(limit);
    if (mongoose.connection.readyState !== 1) {
      const budget = await jsonDb.updateBudget(req.userId, { category: normalizedCategory, limit: normalizedLimit, month });
      return res.json(budget);
    }

    // Use upsert to create or update budget
    const budget = await Budget.findOneAndUpdate(
      ownedQuery(req, { category: normalizedCategory, month }),
      { limit: normalizedLimit, userId: req.userId },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(budget);
  } catch (error) {
    return sendApiError(res, error);
  }
});

// --- DASHBOARD STATS API ---

// Fetch aggregate dashboard statistics
router.get('/dashboard/stats', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) {
      return res.status(400).json({ error: 'Month parameter is required (YYYY-MM)' });
    }
    if (mongoose.connection.readyState !== 1) {
      const stats = await jsonDb.getDashboardStats(req.userId, month);
      return res.json(stats);
    }

    const { start, end } = getMonthRange(month);

    // Get transactions for the month
    const transactions = await Transaction.find(ownedQuery(req, {
      date: { $gte: start, $lt: end }
    }));

    // Get budgets for the month
    const budgets = await Budget.find(ownedQuery(req, { month }));

    // Aggregate calculations
    let totalSpent = 0;
    const spendingByCategory = {};

    transactions.forEach(t => {
      totalSpent += t.amount;
      spendingByCategory[t.category] = (spendingByCategory[t.category] || 0) + t.amount;
    });

    const budgetLimits = {};
    budgets.forEach(b => {
      budgetLimits[b.category] = b.limit;
    });

    // Format category data with spend, limit, and percentage
    const categoriesData = Object.keys(spendingByCategory).map(cat => ({
      category: cat,
      spent: spendingByCategory[cat],
      limit: budgetLimits[cat] || 0,
      percentage: budgetLimits[cat] ? Math.round((spendingByCategory[cat] / budgetLimits[cat]) * 100) : 0
    }));

    // Include budgets that have no spending yet
    budgets.forEach(b => {
      if (!spendingByCategory[b.category]) {
        categoriesData.push({
          category: b.category,
          spent: 0,
          limit: b.limit,
          percentage: 0
        });
      }
    });

    // Recent 5 transactions
    const recentTransactions = await Transaction.find(ownedQuery(req, {
      date: { $gte: start, $lt: end }
    }))
      .sort({ date: -1 })
      .limit(5);

    res.json({
      totalSpent,
      categoriesData,
      recentTransactions,
      transactionCount: transactions.length
    });
  } catch (error) {
    return sendApiError(res, error);
  }
});

// Get historical monthly budget vs spent stats
router.get('/dashboard/history', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const history = await jsonDb.getHistoryStats(req.userId);
      return res.json(history);
    }

    const now = new Date();
    const months = [];
    for (let m = 11; m >= 0; m--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - m, 15);
      const year = targetDate.getFullYear();
      const monthIndex = targetDate.getMonth();
      const monthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
      months.push({ month: monthStr, label: targetDate.toLocaleString('default', { month: 'short', year: '2-digit' }) });
    }

    const firstMonth = months[0].month;
    const lastMonth = months[months.length - 1].month;
    const { start } = getMonthRange(firstMonth);
    const { end } = getMonthRange(lastMonth);
    const [transactions, budgets] = await Promise.all([
      Transaction.find(ownedQuery(req, { date: { $gte: start, $lt: end } })).select('date amount').lean(),
      Budget.find(ownedQuery(req, { month: { $gte: firstMonth, $lte: lastMonth } })).select('month limit').lean()
    ]);
    const totals = new Map(months.map(({ month }) => [month, { spent: 0, budget: 0 }]));
    for (const transaction of transactions) {
      const month = new Date(transaction.date).toISOString().slice(0, 7);
      const total = totals.get(month);
      if (total) total.spent += transaction.amount;
    }
    for (const budget of budgets) {
      const total = totals.get(budget.month);
      if (total) total.budget += budget.limit;
    }
    res.json(months.map(({ month, label }) => ({
      month,
      label,
      spent: Math.round(totals.get(month).spent),
      budget: Math.round(totals.get(month).budget)
    })));
  } catch (error) {
    return sendApiError(res, error);
  }
});

// --- OCR SCAN API ---

// Upload receipt and perform scanning
router.post('/ocr/scan', upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a receipt image!' });
    }

    const filePath = req.file.path;
    const extension = path.extname(req.file.originalname).toLowerCase();
    const expectedMime = RECEIPT_MIME_BY_EXTENSION.get(extension);
    if (!expectedMime || getReceiptImageMime(filePath) !== expectedMime) {
      await fs.promises.unlink(filePath).catch(() => {});
      return res.status(400).json({ error: 'The uploaded file is not a valid supported image.' });
    }
    // Scan receipt
    const scanResult = await scanReceipt(filePath);

    // Relativize path for frontend usage
    const filename = path.basename(filePath);
    const receiptUrl = `/api/uploads/${filename}`;

    res.json({
      ...scanResult,
      receiptUrl
    });
  } catch (error) {
    if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
    console.error('OCR Route error:', error.message);
    res.status(500).json({ error: 'Receipt could not be processed. Please try again.' });
  }
});

router.get('/uploads/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const extension = path.extname(filename).toLowerCase();
  if (!filename.startsWith(`${receiptOwnerPrefix(req.userId)}-`)) {
    return res.status(404).json({ error: 'Receipt not found' });
  }
  const mimeType = RECEIPT_MIME_BY_EXTENSION.get(extension);
  if (!mimeType) return res.status(404).json({ error: 'Receipt not found' });
  let filePath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, '../uploads', filename);
  }
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Receipt not found' });
  res.set('X-Content-Type-Options', 'nosniff');
  res.type(mimeType);
  res.sendFile(filePath);
});

// --- FINANCIAL ADVISOR API ---

// Get AI Insights or chat response
router.post('/advisor/chat', async (req, res) => {
  try {
    const currentMonthDefault = new Date().toISOString().slice(0, 7);
    const month = req.body.month || currentMonthDefault;
    const question = req.body.question || req.body.message || req.body.prompt || null;
    if (question !== null && (typeof question !== 'string' || question.length > 2000)) {
      return res.status(400).json({ error: 'Question must be 2,000 characters or fewer.' });
    }

    const { start, end } = getMonthRange(month);

    // Fetch transactions & budgets
    let transactions, budgets;
    if (mongoose.connection.readyState !== 1) {
      transactions = await jsonDb.getTransactions(req.userId, { month });
      budgets = await jsonDb.getBudgets(req.userId, month);
    } else {
      transactions = await Transaction.find(ownedQuery(req, { date: { $gte: start, $lt: end } }));
      budgets = await Budget.find(ownedQuery(req, { month }));
    }

    // If the current month has no data, supplement with recent all-time transactions
    // so the AI always has meaningful context to analyse
    if (transactions.length === 0) {
      if (mongoose.connection.readyState !== 1) {
        const allTx = await jsonDb.getTransactions(req.userId, {});
        transactions = allTx.slice(-50); // last 50 across all time
      } else {
        transactions = await Transaction.find(ownedQuery(req)).sort({ date: -1 }).limit(50);
      }
    }

    const htmlInsights = await getFinancialAdvisorInsights(transactions, budgets, question);
    res.json({ html: htmlInsights });
  } catch (error) {
    console.error('Advisor error:', error);
    // Always return a valid response — never crash with a bare 500
    const fallbackHtml = '<p>The advisor is temporarily unavailable. Please try again in a moment.</p>';
    res.status(200).json({ html: fallbackHtml });
  }
});

// --- PREDICTIVE FORECASTING API ---

// GET /api/dashboard/forecast
router.get('/dashboard/forecast', async (req, res) => {
  try {
    let transactions, budgets;
    if (mongoose.connection.readyState !== 1) {
      transactions = await jsonDb.getTransactions(req.userId, {});
      budgets = await jsonDb.getAllBudgets(req.userId);
    } else {
      transactions = await Transaction.find(ownedQuery(req));
      budgets = await Budget.find(ownedQuery(req));
    }

    const forecastData = await generateForecast(transactions, budgets);
    res.json(forecastData);
  } catch (error) {
    console.error('Forecast Route error:', error);
    return sendApiError(res, error);
  }
});

// POST /api/budgets/apply-recommendations
router.post('/budgets/apply-recommendations', async (req, res) => {
  try {
    const { recommendations } = req.body; // Expect [{ category, limit, month }]
    if (!Array.isArray(recommendations) || recommendations.length > 100) {
      return res.status(400).json({ error: 'Recommendations must be an array of no more than 100 items.' });
    }
    if (recommendations.length === 0) return res.json({ success: true, message: 'No recommendations to apply.' });
    const validRecommendations = [];
    for (const item of recommendations) {
      if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.category !== 'string' || !item.category.trim() || item.category.length > 80 || typeof item.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(item.month) || !['number', 'string'].includes(typeof item.limit) || !Number.isFinite(Number(item.limit)) || Number(item.limit) <= 0) {
        return res.status(400).json({ error: 'Each recommendation must contain a valid category, month, and positive limit.' });
      }
      validRecommendations.push({ category: item.category.trim(), month: item.month, limit: Number(item.limit) });
    }

    if (mongoose.connection.readyState !== 1) {
      await jsonDb.applyBulkBudgets(req.userId, validRecommendations);
    } else {
      // MongoDB Bulk Write Upsert
      const operations = validRecommendations.map(b => ({
        updateOne: {
          filter: ownedQuery(req, { category: b.category, month: b.month }),
          update: { $set: { limit: b.limit, userId: req.userId } },
          upsert: true
        }
      }));
      await Budget.bulkWrite(operations);
    }

    res.json({ success: true, message: 'Recommended budgets applied successfully.' });
  } catch (error) {
    console.error('Apply Recommendations Route error:', error);
    return sendApiError(res, error);
  }
});

// Algorithmic subscription auto-detection from history
// NOTE: static sub-routes MUST be registered before /:id to avoid the wildcard capturing them
router.get('/subscriptions/detect', async (req, res) => {
  try {
    let transactions;
    if (mongoose.connection.readyState !== 1) {
      transactions = await jsonDb.getTransactions(req.userId, {});
    } else {
      transactions = await Transaction.find(ownedQuery(req));
    }

    const candidates = detectRecurringPayments(transactions);

    // Filter out candidates already tracked as active subscriptions
    let activeSubs = [];
    if (mongoose.connection.readyState !== 1) {
      activeSubs = await jsonDb.getSubscriptions(req.userId);
    } else {
      activeSubs = await Subscription.find(ownedQuery(req));
    }

    const filteredCandidates = candidates.filter((c) =>
      !activeSubs.some(
        (s) =>
          s.description.toLowerCase().includes(c.description.toLowerCase()) ||
          c.description.toLowerCase().includes(s.description.toLowerCase())
      )
    );

    res.json(filteredCandidates);
  } catch (error) {
    return sendApiError(res, error);
  }
});

// Bulk confirm detected subscriptions
router.post('/subscriptions/confirm', async (req, res) => {
  try {
    const { subscriptions } = req.body;
    if (!Array.isArray(subscriptions) || subscriptions.length > 50 || subscriptions.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
      return res.status(400).json({ error: 'Subscriptions must be an array of no more than 50 objects.' });
    }

    const subscriptionData = subscriptions.map((item) => ownedUpdates(item, SUBSCRIPTION_UPDATE_FIELDS));
    for (const item of subscriptionData) {
      const validationError = validateSubscriptionPayload(item);
      if (validationError) return res.status(400).json({ error: validationError });
    }

    const results = [];
    for (const item of subscriptionData) {
      if (mongoose.connection.readyState !== 1) {
        results.push(await jsonDb.createSubscription(req.userId, item));
      } else {
        const sub = new Subscription({ ...item, userId: req.userId });
        await sub.save();
        results.push(sub);
      }
    }

    res.status(201).json({ success: true, count: results.length });
  } catch (error) {
    return sendApiError(res, error);
  }
});

// Signed-in users can process only their own due subscriptions.
router.post('/subscriptions/run-scheduler', async (req, res) => {
  try {
    const jsonDbMode = mongoose.connection.readyState !== 1;
    const result = await checkAndLogDueSubscriptions(jsonDbMode, req.userId);
    res.json(result);
  } catch (error) {
    return sendApiError(res, error);
  }
});

// Get all active subscriptions
router.get('/subscriptions', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const subs = await jsonDb.getSubscriptions(req.userId);
      return res.json(subs);
    }
    const subs = await Subscription.find(ownedQuery(req));
    res.json(subs);
  } catch (error) {
    return sendApiError(res, error);
  }
});

// Create a subscription
router.post('/subscriptions', async (req, res) => {
  try {
    const hasId = req.body._id !== undefined;
    if (hasId && (typeof req.body._id !== 'string' || !req.body._id || req.body._id.length > 100)) {
      return res.status(400).json({ error: 'Subscription ID is invalid.' });
    }
    const updates = ownedUpdates(req.body, SUBSCRIPTION_UPDATE_FIELDS);
    const validationError = validateSubscriptionPayload(updates, hasId);
    if (validationError) return res.status(400).json({ error: validationError });

    if (mongoose.connection.readyState !== 1) {
      if (hasId) {
        const updated = await jsonDb.updateSubscription(req.userId, req.body._id, updates);
        if (!updated) return res.status(404).json({ error: 'Subscription not found' });
        return res.json(updated);
      }
      const sub = await jsonDb.createSubscription(req.userId, {
        ...updates,
        category: updates.category || 'Other',
        billingCycle: updates.billingCycle || 'monthly',
        nextDueDate: updates.nextDueDate || new Date().toISOString(),
        status: updates.status || 'active',
        paymentMethod: updates.paymentMethod || 'Card'
      });
      return res.status(201).json(sub);
    }
    const { description, amount, category, merchant, billingCycle, nextDueDate, status, paymentMethod, isEMI, tenureMonths, remainingMonths } = req.body;

    let sub;
    if (hasId) {
      sub = await Subscription.findOneAndUpdate(
        ownedQuery(req, { _id: req.body._id }),
        updates,
        { new: true, runValidators: true }
      );
    } else {
      sub = new Subscription({
        userId: req.userId,
        description,
        amount,
        category: category || 'Other',
        merchant: merchant || '',
        billingCycle: billingCycle || 'monthly',
        nextDueDate: nextDueDate || new Date(),
        status: status || 'active',
        paymentMethod: paymentMethod || 'Card',
        isEMI: isEMI === true || isEMI === 'true',
        tenureMonths: tenureMonths || null,
        remainingMonths: remainingMonths || null,
      });
      await sub.save();
    }
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });
    res.status(hasId ? 200 : 201).json(sub);
  } catch (error) {
    return sendApiError(res, error);
  }
});

// Delete a subscription by id
router.delete('/subscriptions/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const result = await jsonDb.deleteSubscription(req.userId, req.params.id);
      if (!result) return res.status(404).json({ error: 'Subscription not found' });
      return res.json({ message: 'Subscription deleted successfully' });
    }
    const sub = await Subscription.findOneAndDelete(ownedQuery(req, { _id: req.params.id }));
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ message: 'Subscription deleted successfully' });
  } catch (error) {
    return sendApiError(res, error);
  }
});


// --- SAVINGS GOALS API ---

// Get all goals
router.get('/goals', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const goals = await jsonDb.getGoals(req.userId);
      return res.json(goals);
    }
    const goals = await Goal.find(ownedQuery(req)).sort({ createdAt: -1 });
    res.json(goals);
  } catch (error) {
    return sendApiError(res, error);
  }
});

// Create new goal
router.post('/goals', async (req, res) => {
  try {
    const { name, targetAmount, currentAmount, targetDate, frequency, contributionAmount, category, color, notes } = req.body;
    if (typeof name !== 'string' || !name.trim() || name.length > 120 || !['number', 'string'].includes(typeof targetAmount) || typeof targetDate !== 'string' || !Number.isFinite(Date.parse(targetDate))) {
      return res.status(400).json({ error: 'Name, target amount, and target date are required' });
    }

    const currentSource = currentAmount ?? 0;
    const contributionSource = contributionAmount ?? 0;
    if (!['number', 'string'].includes(typeof currentSource) || !['number', 'string'].includes(typeof contributionSource)) {
      return res.status(400).json({ error: 'Goal amounts must be numeric values.' });
    }
    const targetAmountNumber = Number(targetAmount);
    const currentAmountNumber = Number(currentSource);
    const contributionAmountNumber = Number(contributionSource);
    if (!Number.isFinite(targetAmountNumber) || targetAmountNumber < 1 || !Number.isFinite(currentAmountNumber) || currentAmountNumber < 0 || !Number.isFinite(contributionAmountNumber) || contributionAmountNumber < 0) {
      return res.status(400).json({ error: 'Goal amounts must be finite non-negative numbers, with a target of at least 1.' });
    }
    if (frequency !== undefined && !['Weekly', 'Monthly', 'Yearly'].includes(frequency)) {
      return res.status(400).json({ error: 'Goal frequency is invalid.' });
    }
    if (category !== undefined && (typeof category !== 'string' || category.length > 80)) return res.status(400).json({ error: 'Goal category is invalid.' });
    if (color !== undefined && (typeof color !== 'string' || !/^#[\da-f]{6}$/i.test(color))) return res.status(400).json({ error: 'Goal color must be a six-digit hex color.' });
    if (notes !== undefined && (typeof notes !== 'string' || notes.length > 5000)) return res.status(400).json({ error: 'Goal notes are too long.' });

    const payload = {
      name: name.trim(),
      targetAmount: targetAmountNumber,
      currentAmount: currentAmountNumber,
      targetDate,
      frequency: frequency || 'Monthly',
      contributionAmount: contributionAmountNumber,
      category: category || 'General',
      color: color || '#866ec7',
      notes: notes || '',
      isCompleted: currentAmountNumber >= targetAmountNumber
    };

    if (mongoose.connection.readyState !== 1) {
      const goal = await jsonDb.createGoal(req.userId, payload);
      return res.status(201).json(goal);
    }

    const goal = await Goal.create({ ...payload, userId: req.userId });
    res.status(201).json(goal);
  } catch (error) {
    return sendApiError(res, error);
  }
});

// Update goal (including contributing funds)
router.put('/goals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = ownedUpdates(req.body, GOAL_UPDATE_FIELDS);

    for (const [field, minimum] of [['targetAmount', 1], ['currentAmount', 0], ['contributionAmount', 0]]) {
      if (updates[field] === undefined) continue;
      if (!['number', 'string'].includes(typeof updates[field])) return res.status(400).json({ error: 'Goal amounts must be numeric values.' });
      const value = Number(updates[field]);
      if (!Number.isFinite(value) || value < minimum) {
        return res.status(400).json({ error: 'Goal amounts must be finite non-negative numbers, with a target of at least 1.' });
      }
      updates[field] = value;
    }
    if (updates.targetDate !== undefined && (typeof updates.targetDate !== 'string' || !Number.isFinite(Date.parse(updates.targetDate)))) {
      return res.status(400).json({ error: 'Goal target date is invalid.' });
    }
    if (updates.frequency !== undefined && !['Weekly', 'Monthly', 'Yearly'].includes(updates.frequency)) {
      return res.status(400).json({ error: 'Goal frequency is invalid.' });
    }
    if (updates.name !== undefined) {
      if (typeof updates.name !== 'string' || !updates.name.trim() || updates.name.length > 120) return res.status(400).json({ error: 'Goal name is invalid.' });
      updates.name = updates.name.trim();
    }
    if (updates.category !== undefined && (typeof updates.category !== 'string' || updates.category.length > 80)) return res.status(400).json({ error: 'Goal category is invalid.' });
    if (updates.color !== undefined && (typeof updates.color !== 'string' || !/^#[\da-f]{6}$/i.test(updates.color))) return res.status(400).json({ error: 'Goal color must be a six-digit hex color.' });
    if (updates.notes !== undefined && (typeof updates.notes !== 'string' || updates.notes.length > 5000)) return res.status(400).json({ error: 'Goal notes are too long.' });

    if (updates.targetAmount && updates.currentAmount !== undefined) {
      updates.isCompleted = updates.currentAmount >= updates.targetAmount;
    }

    if (mongoose.connection.readyState !== 1) {
      const updated = await jsonDb.updateGoal(req.userId, id, updates);
      if (!updated) return res.status(404).json({ error: 'Goal not found' });
      return res.json(updated);
    }

    const goal = await Goal.findOne(ownedQuery(req, { _id: id }));
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    Object.assign(goal, updates);
    goal.isCompleted = goal.currentAmount >= goal.targetAmount;
    await goal.save();
    res.json(goal);
  } catch (error) {
    return sendApiError(res, error);
  }
});

// Contribute funds to a goal
router.post('/goals/:id/contribute', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Valid contribution amount is required' });
    }

    const addVal = Number(amount);

    if (mongoose.connection.readyState !== 1) {
      const goals = await jsonDb.getGoals(req.userId);
      const target = goals.find(g => g._id === id);
      if (!target) return res.status(404).json({ error: 'Goal not found' });
      const newAmount = (target.currentAmount || 0) + addVal;
      const updated = await jsonDb.updateGoal(req.userId, id, { currentAmount: newAmount });
      return res.json(updated);
    }

    const goal = await Goal.findOne(ownedQuery(req, { _id: id }));
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    goal.currentAmount += addVal;
    goal.isCompleted = goal.currentAmount >= goal.targetAmount;
    await goal.save();
    res.json(goal);
  } catch (error) {
    return sendApiError(res, error);
  }
});

// Delete goal
router.delete('/goals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (mongoose.connection.readyState !== 1) {
      const result = await jsonDb.deleteGoal(req.userId, id);
      if (!result) return res.status(404).json({ error: 'Goal not found' });
      return res.json({ message: 'Goal deleted successfully' });
    }

    const goal = await Goal.findOneAndDelete(ownedQuery(req, { _id: id }));
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    res.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    return sendApiError(res, error);
  }
});

export default router;
