import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import Budget from '../models/Budget.js';
import { autoCategorize, getFinancialAdvisorInsights } from '../services/aiService.js';
import { scanReceipt } from '../services/ocrService.js';
import { jsonDb } from '../services/jsonDbService.js';
import { generateForecast } from '../services/forecastService.js';
import Subscription from '../models/Subscription.js';
import { detectRecurringPayments, checkAndLogDueSubscriptions } from '../services/subscriptionService.js';
import { authenticate, login } from '../middleware/auth.js';

const router = express.Router();

router.post('/auth/login', login);
router.use(authenticate);

router.use((req, res, next) => {
  const monthValues = [req.query.month, req.body?.month];
  if (monthValues.some((month) => month !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))) {
    return res.status(400).json({ error: 'Month must use YYYY-MM format' });
  }
  const amountValues = [req.body?.amount, req.body?.limit];
  if (amountValues.some((amount) => amount !== undefined && (!Number.isFinite(Number(amount)) || Number(amount) <= 0))) {
    return res.status(400).json({ error: 'Amounts must be positive finite numbers' });
  }
  if (typeof req.query.search === 'string' && req.query.search.length > 100) {
    return res.status(400).json({ error: 'Search text is too long' });
  }
  next();
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Setup Multer for receipt uploads
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, JPEG, and PNG images are allowed!'));
    }
  }
});

// --- TRANSACTIONS API ---

// Get all transactions with search, filter, and pagination
router.get('/transactions', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const transactions = await jsonDb.getTransactions(req.query);
      return res.json(transactions);
    }
    const { category, search, month } = req.query;
    let query = {};

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
      // month is expected as 'YYYY-MM'
      const start = new Date(`${month}-01T00:00:00.000Z`);
      const year = parseInt(month.split('-')[0]);
      const nextMonth = parseInt(month.split('-')[1]);
      
      let end;
      if (nextMonth === 12) {
        end = new Date(`${year + 1}-01-01T00:00:00.000Z`);
      } else {
        const nextMonthStr = String(nextMonth + 1).padStart(2, '0');
        end = new Date(`${year}-${nextMonthStr}-01T00:00:00.000Z`);
      }

      query.date = { $gte: start, $lt: end };
    }

    const transactions = await Transaction.find(query).sort({ date: -1 });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new transaction
router.post('/transactions', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const transaction = await jsonDb.createTransaction(req.body);
      return res.status(201).json(transaction);
    }
    const { description, amount, date, paymentMethod, merchant, tags, notes, category } = req.body;

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
      description,
      amount,
      date: date || new Date(),
      paymentMethod: paymentMethod || 'Cash',
      category: finalCategory,
      merchant: finalMerchant,
      tags: tags || [],
      notes: notes || '',
      isAutoCategorized: isAuto
    });

    await transaction.save();
    res.status(201).json(transaction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update a transaction
router.put('/transactions/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const transaction = await jsonDb.updateTransaction(req.params.id, req.body);
      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      return res.json(transaction);
    }
    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json(transaction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a transaction
router.delete('/transactions/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const result = await jsonDb.deleteTransaction(req.params.id);
      if (!result) {
        return res.status(404).json({ error: 'Transaction not found' });
      }
      return res.json({ message: 'Transaction deleted successfully' });
    }
    const transaction = await Transaction.findByIdAndDelete(req.params.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
      const budgets = await jsonDb.getBudgets(month);
      return res.json(budgets);
    }
    const budgets = await Budget.find({ month });
    res.json(budgets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create or update a budget limit
router.post('/budgets', async (req, res) => {
  try {
    const { category, limit, month } = req.body;
    if (!category || !limit || !month) {
      return res.status(400).json({ error: 'category, limit, and month are required' });
    }
    if (mongoose.connection.readyState !== 1) {
      const budget = await jsonDb.updateBudget(req.body);
      return res.json(budget);
    }

    // Use upsert to create or update budget
    const budget = await Budget.findOneAndUpdate(
      { category, month },
      { limit },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(budget);
  } catch (error) {
    res.status(400).json({ error: error.message });
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
      const stats = await jsonDb.getDashboardStats(month);
      return res.json(stats);
    }

    const start = new Date(`${month}-01T00:00:00.000Z`);
    const year = parseInt(month.split('-')[0]);
    const m = parseInt(month.split('-')[1]);
    
    let end;
    if (m === 12) {
      end = new Date(`${year + 1}-01-01T00:00:00.000Z`);
    } else {
      const nextMonthStr = String(m + 1).padStart(2, '0');
      end = new Date(`${year}-${nextMonthStr}-01T00:00:00.000Z`);
    }

    // Get transactions for the month
    const transactions = await Transaction.find({
      date: { $gte: start, $lt: end }
    });

    // Get budgets for the month
    const budgets = await Budget.find({ month });

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
    const recentTransactions = await Transaction.find({
      date: { $gte: start, $lt: end }
    })
      .sort({ date: -1 })
      .limit(5);

    res.json({
      totalSpent,
      categoriesData,
      recentTransactions,
      transactionCount: transactions.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get historical monthly budget vs spent stats
router.get('/dashboard/history', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const history = await jsonDb.getHistoryStats();
      return res.json(history);
    }

    const now = new Date();
    const history = [];

    for (let m = 11; m >= 0; m--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - m, 15);
      const year = targetDate.getFullYear();
      const monthIndex = targetDate.getMonth();
      const monthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

      const start = new Date(`${monthStr}-01T00:00:00.000Z`);
      let end;
      if (monthIndex === 11) {
        end = new Date(`${year + 1}-01-01T00:00:00.000Z`);
      } else {
        const nextMonthStr = String(monthIndex + 2).padStart(2, '0');
        end = new Date(`${year}-${nextMonthStr}-01T00:00:00.000Z`);
      }

      // Aggregate spent
      const txs = await Transaction.find({
        date: { $gte: start, $lt: end }
      });
      const spent = txs.reduce((sum, t) => sum + t.amount, 0);

      // Aggregate budget limits
      const bgts = await Budget.find({ month: monthStr });
      const budgetLimit = bgts.reduce((sum, b) => sum + b.limit, 0);

      const monthLabel = targetDate.toLocaleString('default', { month: 'short', year: '2-digit' });

      history.push({
        month: monthStr,
        label: monthLabel,
        spent: Math.round(spent),
        budget: Math.round(budgetLimit)
      });
    }

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    console.error('OCR Route error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/uploads/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Receipt not found' });
  res.sendFile(filePath);
});

// --- FINANCIAL ADVISOR API ---

// Get AI Insights or chat response
router.post('/advisor/chat', async (req, res) => {
  try {
    const { month, question } = req.body;
    if (!month) {
      return res.status(400).json({ error: 'month parameter is required (YYYY-MM)' });
    }

    const start = new Date(`${month}-01T00:00:00.000Z`);
    const year = parseInt(month.split('-')[0]);
    const m = parseInt(month.split('-')[1]);
    
    let end;
    if (m === 12) {
      end = new Date(`${year + 1}-01-01T00:00:00.000Z`);
    } else {
      const nextMonthStr = String(m + 1).padStart(2, '0');
      end = new Date(`${year}-${nextMonthStr}-01T00:00:00.000Z`);
    }

    // Fetch transactions & budgets
    let transactions, budgets;
    if (mongoose.connection.readyState !== 1) {
      transactions = await jsonDb.getTransactions({ month });
      budgets = await jsonDb.getBudgets(month);
    } else {
      transactions = await Transaction.find({
        date: { $gte: start, $lt: end }
      });
      budgets = await Budget.find({ month });
    }

    const htmlInsights = await getFinancialAdvisorInsights(transactions, budgets, question);
    res.json({ html: htmlInsights });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- PREDICTIVE FORECASTING API ---

// GET /api/dashboard/forecast
router.get('/dashboard/forecast', async (req, res) => {
  try {
    let transactions, budgets;
    if (mongoose.connection.readyState !== 1) {
      transactions = await jsonDb.getTransactions({});
      budgets = await jsonDb.getAllBudgets();
    } else {
      transactions = await Transaction.find();
      budgets = await Budget.find();
    }

    const forecastData = await generateForecast(transactions, budgets);
    res.json(forecastData);
  } catch (error) {
    console.error('Forecast Route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/budgets/apply-recommendations
router.post('/budgets/apply-recommendations', async (req, res) => {
  try {
    const { recommendations } = req.body; // Expect [{ category, limit, month }]
    if (!recommendations || !Array.isArray(recommendations)) {
      return res.status(400).json({ error: 'Recommendations list is required and must be an array.' });
    }

    if (mongoose.connection.readyState !== 1) {
      await jsonDb.applyBulkBudgets(recommendations);
    } else {
      // MongoDB Bulk Write Upsert
      const operations = recommendations.map(b => ({
        updateOne: {
          filter: { category: b.category, month: b.month },
          update: { limit: b.limit },
          upsert: true
        }
      }));
      await Budget.bulkWrite(operations);
    }

    res.json({ success: true, message: 'Recommended budgets applied successfully.' });
  } catch (error) {
    console.error('Apply Recommendations Route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Algorithmic subscription auto-detection from history
// NOTE: static sub-routes MUST be registered before /:id to avoid the wildcard capturing them
router.get('/subscriptions/detect', async (req, res) => {
  try {
    let transactions;
    if (mongoose.connection.readyState !== 1) {
      transactions = await jsonDb.getTransactions({});
    } else {
      transactions = await Transaction.find();
    }

    const candidates = detectRecurringPayments(transactions);

    // Filter out candidates already tracked as active subscriptions
    let activeSubs = [];
    if (mongoose.connection.readyState !== 1) {
      activeSubs = await jsonDb.getSubscriptions();
    } else {
      activeSubs = await Subscription.find();
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
    res.status(500).json({ error: error.message });
  }
});

// Bulk confirm detected subscriptions
router.post('/subscriptions/confirm', async (req, res) => {
  try {
    const { subscriptions } = req.body;
    if (!subscriptions || !Array.isArray(subscriptions)) {
      return res.status(400).json({ error: 'Subscriptions list is required and must be an array.' });
    }

    const results = [];
    for (const s of subscriptions) {
      if (mongoose.connection.readyState !== 1) {
        results.push(await jsonDb.createSubscription(s));
      } else {
        const sub = new Subscription(s);
        await sub.save();
        results.push(sub);
      }
    }

    res.status(201).json({ success: true, count: results.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Force log transactions due for subscriptions
router.post('/subscriptions/run-scheduler', async (req, res) => {
  try {
    const jsonDbMode = mongoose.connection.readyState !== 1;
    const result = await checkAndLogDueSubscriptions(jsonDbMode);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all active subscriptions
router.get('/subscriptions', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const subs = await jsonDb.getSubscriptions();
      return res.json(subs);
    }
    const subs = await Subscription.find();
    res.json(subs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a subscription
router.post('/subscriptions', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      if (req.body._id) {
        const updated = await jsonDb.updateSubscription(req.body._id, req.body);
        if (!updated) return res.status(404).json({ error: 'Subscription not found' });
        return res.json(updated);
      }
      const sub = await jsonDb.createSubscription(req.body);
      return res.status(201).json(sub);
    }
    const { _id, description, amount, category, merchant, billingCycle, nextDueDate, status, paymentMethod, isEMI, tenureMonths, remainingMonths } = req.body;

    let sub;
    if (_id) {
      sub = await Subscription.findByIdAndUpdate(_id, req.body, { new: true, runValidators: true });
    } else {
      sub = new Subscription({
        description,
        amount,
        category: category || 'Other',
        merchant: merchant || '',
        billingCycle: billingCycle || 'monthly',
        nextDueDate: nextDueDate || new Date(),
        status: status || 'active',
        paymentMethod: paymentMethod || 'Card',
        isEMI: isEMI || false,
        tenureMonths: tenureMonths || null,
        remainingMonths: remainingMonths || null,
      });
      await sub.save();
    }
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });
    res.status(_id ? 200 : 201).json(sub);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a subscription by id
router.delete('/subscriptions/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const result = await jsonDb.deleteSubscription(req.params.id);
      if (!result) return res.status(404).json({ error: 'Subscription not found' });
      return res.json({ message: 'Subscription deleted successfully' });
    }
    const sub = await Subscription.findByIdAndDelete(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ message: 'Subscription deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
