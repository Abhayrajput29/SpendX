import fs from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { autoCategorize } from './aiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbFilePath = process.env.SPENDX_DB_PATH
  ? path.resolve(process.env.SPENDX_DB_PATH)
  : process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
    ? path.join(os.tmpdir(), 'spendx_db.json')
    : path.join(__dirname, '../data/db.json');

let memoryDbCache = null;

function emptyDbData() {
  return {
    transactions: [],
    budgets: [],
    subscriptions: [],
    goals: [],
    users: []
  };
}

function normalizeDbData(data = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Local database snapshot must be an object.');
  }
  for (const collection of ['transactions', 'budgets', 'subscriptions', 'goals', 'users']) {
    if (data[collection] !== undefined && !Array.isArray(data[collection])) {
      throw new Error(`Local database collection is invalid: ${collection}.`);
    }
  }
  return {
    ...data,
    transactions: Array.isArray(data.transactions) ? data.transactions : [],
    budgets: Array.isArray(data.budgets) ? data.budgets : [],
    subscriptions: Array.isArray(data.subscriptions) ? data.subscriptions : [],
    goals: Array.isArray(data.goals) ? data.goals : [],
    users: Array.isArray(data.users) ? data.users : []
  };
}

function cloneDbData(data) {
  return JSON.parse(JSON.stringify(data));
}

function publicTransaction(transaction) {
  if (!transaction) return transaction;
  const { schedulerKey, ...visibleTransaction } = transaction;
  return visibleTransaction;
}

function requireUserId(userId) {
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new Error('Authenticated user is required for personal data access');
  }
  return userId;
}

/**
 * Initialize local database file
 */
function initDb() {
  if (memoryDbCache) return;

  const dir = path.dirname(dbFilePath);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    } catch {
      // Ignore directory creation error in serverless
    }
  }

  if (fs.existsSync(dbFilePath)) return;

  try {
    const data = emptyDbData();
    fs.writeFileSync(dbFilePath, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 });
    memoryDbCache = data;
  } catch (error) {
    console.warn('JSON DB Service: Using empty in-memory database (disk write unavailable):', error.message);
    memoryDbCache = emptyDbData();
  }
}

/**
 * Read raw data
 */
export function readRawData() {
  if (memoryDbCache) return cloneDbData(memoryDbCache);
  initDb();
  try {
    if (fs.existsSync(dbFilePath)) {
      const raw = fs.readFileSync(dbFilePath, 'utf-8');
      const parsed = normalizeDbData(JSON.parse(raw));
      memoryDbCache = parsed;
      return cloneDbData(parsed);
    }
  } catch (error) {
    console.error('JSON DB Service: Failed to read local db.json; refusing to overwrite the existing snapshot.', error.message);
    throw new Error('The local database could not be read.', { cause: error });
  }
  if (!memoryDbCache) memoryDbCache = emptyDbData();
  return cloneDbData(memoryDbCache);
}

/**
 * Write raw data
 */
export function writeRawData(data) {
  const normalized = normalizeDbData(data);
  const temporaryPath = `${dbFilePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
    fs.writeFileSync(temporaryPath, JSON.stringify(normalized, null, 2), { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(temporaryPath, dbFilePath);
    memoryDbCache = normalized;
  } catch (error) {
    try {
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    } catch {
      // Preserve the original persistence error.
    }
    console.error('JSON DB Service: Failed to persist database update:', error.message);
    throw new Error('The local database could not save this change.', { cause: error });
  }
}

export const jsonDb = {
  getTransactions: async (userId, filters = {}) => {
    const ownerId = requireUserId(userId);
    const { category, search, month, sortBy } = filters;
    const data = readRawData();
    let list = data.transactions.filter((transaction) => transaction.userId === ownerId);

    if (category) {
      list = list.filter(t => t.category === category);
    }

    if (search) {
      const s = search.toLowerCase();
      list = list.filter(t => 
        (t.description && t.description.toLowerCase().includes(s)) ||
        (t.merchant && t.merchant.toLowerCase().includes(s)) ||
        (t.notes && t.notes.toLowerCase().includes(s))
      );
    }

    if (month) {
      list = list.filter(t => t.date && t.date.slice(0, 7) === month);
    }

    const sortComparators = {
      createdAt: (a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date),
      dateAsc: (a, b) => new Date(a.date) - new Date(b.date),
      amountDesc: (a, b) => b.amount - a.amount,
      amountAsc: (a, b) => a.amount - b.amount
    };
    const compare = sortComparators[sortBy] || ((a, b) => new Date(b.date) - new Date(a.date));
    return list.sort(compare).map(publicTransaction);
  },

  createTransaction: async (userId, txData, options = {}) => {
    const ownerId = requireUserId(userId);
    const schedulerKey = typeof options.schedulerKey === 'string' ? options.schedulerKey : null;
    const withCreationStatus = options.withCreationStatus === true;
    const result = (transaction, created) => withCreationStatus
      ? { transaction: publicTransaction(transaction), created }
      : publicTransaction(transaction);
    if (schedulerKey) {
      const existing = readRawData().transactions.find((transaction) => transaction.userId === ownerId && transaction.schedulerKey === schedulerKey);
      if (existing) return result(existing, false);
    }
    const { description, amount, date, paymentMethod, merchant, tags, notes, category, receiptUrl } = txData;

    let finalCategory = category;
    let isAuto = false;
    let aiResult = null;

    if (!finalCategory || finalCategory === 'Other' || finalCategory === 'Miscellaneous') {
      aiResult = await autoCategorize(description);
      finalCategory = aiResult.category;
      isAuto = true;
    }

    let finalMerchant = merchant;
    if (!finalMerchant) {
      if (!aiResult) aiResult = await autoCategorize(description);
      finalMerchant = aiResult.merchant;
    }

    const data = readRawData();
    if (schedulerKey) {
      const existing = data.transactions.find((transaction) => transaction.userId === ownerId && transaction.schedulerKey === schedulerKey);
      if (existing) return result(existing, false);
    }
    const newTx = {
      _id: 'mock-tx-' + randomUUID(),
      userId: ownerId,
      description,
      amount: parseFloat(amount),
      date: date || new Date().toISOString(),
      paymentMethod: paymentMethod || 'Cash',
      category: finalCategory,
      merchant: finalMerchant,
      receiptUrl: receiptUrl || '',
      tags: tags || [],
      notes: notes || '',
      isAutoCategorized: isAuto,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(schedulerKey ? { schedulerKey } : {})
    };

    data.transactions.push(newTx);
    writeRawData(data);
    return result(newTx, true);
  },

  updateTransaction: async (userId, id, updates) => {
    const ownerId = requireUserId(userId);
    const data = readRawData();
    const idx = data.transactions.findIndex(t => t._id === id && t.userId === ownerId);
    if (idx === -1) return null;

    const original = data.transactions[idx];
    const updated = {
      ...original,
      ...updates,
      _id: original._id,
      userId: ownerId,
      amount: updates.amount ? parseFloat(updates.amount) : original.amount,
      updatedAt: new Date().toISOString()
    };

    data.transactions[idx] = updated;
    writeRawData(data);
    return publicTransaction(updated);
  },

  deleteTransaction: async (userId, id) => {
    const ownerId = requireUserId(userId);
    const data = readRawData();
    const idx = data.transactions.findIndex(t => t._id === id && t.userId === ownerId);
    if (idx === -1) return null;

    data.transactions.splice(idx, 1);
    writeRawData(data);
    return { success: true };
  },

  getBudgets: async (userId, month) => {
    const ownerId = requireUserId(userId);
    const data = readRawData();
    return data.budgets.filter(b => b.userId === ownerId && b.month === month);
  },

  updateBudget: async (userId, budgetData) => {
    const ownerId = requireUserId(userId);
    const { category, limit, month } = budgetData;
    const data = readRawData();
    
    const idx = data.budgets.findIndex(b => b.userId === ownerId && b.category === category && b.month === month);
    const limitNum = parseFloat(limit);

    let updatedBudget;
    if (idx !== -1) {
      data.budgets[idx].limit = limitNum;
      updatedBudget = data.budgets[idx];
    } else {
      updatedBudget = {
        _id: 'mock-b-' + Date.now(),
        userId: ownerId,
        category,
        limit: limitNum,
        month,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      data.budgets.push(updatedBudget);
    }

    writeRawData(data);
    return updatedBudget;
  },

  getDashboardStats: async (userId, month) => {
    const ownerId = requireUserId(userId);
    const data = readRawData();
    
    // Filter transactions for this month
    const thisMonthTransactions = data.transactions.filter(t => t.userId === ownerId && t.date && t.date.slice(0, 7) === month);
    
    // Filter budgets for this month
    const thisMonthBudgets = data.budgets.filter(b => b.userId === ownerId && b.month === month);

    let totalSpent = 0;
    const spendingByCategory = {};

    thisMonthTransactions.forEach(t => {
      totalSpent += t.amount;
      spendingByCategory[t.category] = (spendingByCategory[t.category] || 0) + t.amount;
    });

    const budgetLimits = {};
    thisMonthBudgets.forEach(b => {
      budgetLimits[b.category] = b.limit;
    });

    const categoriesData = Object.keys(spendingByCategory).map(cat => ({
      category: cat,
      spent: spendingByCategory[cat],
      limit: budgetLimits[cat] || 0,
      percentage: budgetLimits[cat] ? Math.round((spendingByCategory[cat] / budgetLimits[cat]) * 100) : 0
    }));

    thisMonthBudgets.forEach(b => {
      if (!spendingByCategory[b.category]) {
        categoriesData.push({
          category: b.category,
          spent: 0,
          limit: b.limit,
          percentage: 0
        });
      }
    });

    // Sort transactions by date desc and limit to 5
    const recent = [...thisMonthTransactions]
      .sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
      .slice(0, 5);

    return {
      totalSpent,
      categoriesData,
      recentTransactions: recent.map(publicTransaction),
      transactionCount: thisMonthTransactions.length
    };
  },

  getHistoryStats: async (userId) => {
    const ownerId = requireUserId(userId);
    const data = readRawData();
    const now = new Date();
    const months = [];
    for (let m = 11; m >= 0; m--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - m, 15);
      const year = targetDate.getFullYear();
      const monthIndex = targetDate.getMonth();
      const monthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
      months.push({ month: monthStr, label: targetDate.toLocaleString('default', { month: 'short', year: '2-digit' }) });
    }

    const totals = new Map(months.map(({ month }) => [month, { spent: 0, budget: 0 }]));
    for (const transaction of data.transactions) {
      if (transaction.userId !== ownerId || !transaction.date) continue;
      const total = totals.get(transaction.date.slice(0, 7));
      if (total) total.spent += transaction.amount;
    }
    for (const budget of data.budgets) {
      if (budget.userId !== ownerId) continue;
      const total = totals.get(budget.month);
      if (total) total.budget += budget.limit;
    }
    return months.map(({ month, label }) => ({
      month,
      label,
      spent: Math.round(totals.get(month).spent),
      budget: Math.round(totals.get(month).budget)
    }));
  },

  getAllBudgets: async (userId) => {
    const ownerId = requireUserId(userId);
    const data = readRawData();
    return data.budgets.filter((budget) => budget.userId === ownerId);
  },

  applyBulkBudgets: async (userId, budgetsList) => {
    const ownerId = requireUserId(userId);
    const data = readRawData();
    budgetsList.forEach(b => {
      const idx = data.budgets.findIndex(x => x.userId === ownerId && x.category === b.category && x.month === b.month);
      const limitNum = parseFloat(b.limit);
      if (idx !== -1) {
        data.budgets[idx].limit = limitNum;
        data.budgets[idx].updatedAt = new Date().toISOString();
      } else {
        data.budgets.push({
          _id: 'mock-b-' + (Date.now() + Math.random()),
          userId: ownerId,
          category: b.category,
          limit: limitNum,
          month: b.month,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    });
    writeRawData(data);
    return { success: true };
  },

  getSubscriptions: async (userId) => {
    const ownerId = requireUserId(userId);
    const data = readRawData();
    return (data.subscriptions || []).filter((subscription) => subscription.userId === ownerId);
  },

  getAllSubscriptionsForScheduler: async () => {
    const data = readRawData();
    return data.subscriptions || [];
  },

  createSubscription: async (userId, subData) => {
    const ownerId = requireUserId(userId);
    const data = readRawData();
    const newSub = {
      status: 'active',
      ...subData,
      _id: 'mock-sub-' + (Date.now() + Math.random()),
      userId: ownerId,
      amount: parseFloat(subData.amount),
      isEMI: subData.isEMI === true || subData.isEMI === 'true',
      tenureMonths: subData.tenureMonths ? parseInt(subData.tenureMonths) : null,
      remainingMonths: subData.remainingMonths ? parseInt(subData.remainingMonths) : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!data.subscriptions) data.subscriptions = [];
    data.subscriptions.push(newSub);
    writeRawData(data);
    return newSub;
  },

  updateSubscription: async (userId, id, updates) => {
    const ownerId = requireUserId(userId);
    const data = readRawData();
    if (!data.subscriptions) data.subscriptions = [];
    const idx = data.subscriptions.findIndex(s => s._id === id && s.userId === ownerId);
    if (idx === -1) return null;
    const original = data.subscriptions[idx];
    const updated = {
      ...original,
      ...updates,
      _id: original._id,
      userId: ownerId,
      amount: updates.amount ? parseFloat(updates.amount) : original.amount,
      isEMI: updates.isEMI !== undefined ? (updates.isEMI === true || updates.isEMI === 'true') : original.isEMI,
      tenureMonths: updates.tenureMonths !== undefined ? (updates.tenureMonths ? parseInt(updates.tenureMonths) : null) : original.tenureMonths,
      remainingMonths: updates.remainingMonths !== undefined ? (updates.remainingMonths ? parseInt(updates.remainingMonths) : null) : original.remainingMonths,
      updatedAt: new Date().toISOString()
    };
    data.subscriptions[idx] = updated;
    writeRawData(data);
    return updated;
  },

  deleteSubscription: async (userId, id) => {
    const ownerId = requireUserId(userId);
    const data = readRawData();
    if (!data.subscriptions) data.subscriptions = [];
    const idx = data.subscriptions.findIndex(s => s._id === id && s.userId === ownerId);
    if (idx === -1) return null;
    data.subscriptions.splice(idx, 1);
    writeRawData(data);
    return { success: true };
  },


  getGoals: async (userId) => {
    const ownerId = requireUserId(userId);
    const data = readRawData();
    return (data.goals || []).filter((goal) => goal.userId === ownerId);
  },

  createGoal: async (userId, goalData) => {
    const ownerId = requireUserId(userId);
    const data = readRawData();
    const newGoal = {
      _id: 'mock-goal-' + (Date.now() + Math.random()),
      currentAmount: 0,
      isCompleted: false,
      ...goalData,
      userId: ownerId,
      targetAmount: parseFloat(goalData.targetAmount),
      contributionAmount: parseFloat(goalData.contributionAmount || 0),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!data.goals) data.goals = [];
    data.goals.push(newGoal);
    writeRawData(data);
    return newGoal;
  },

  updateGoal: async (userId, id, updates) => {
    const ownerId = requireUserId(userId);
    const data = readRawData();
    if (!data.goals) data.goals = [];
    const idx = data.goals.findIndex(g => g._id === id && g.userId === ownerId);
    if (idx === -1) return null;
    const original = data.goals[idx];
    const updated = {
      ...original,
      ...updates,
      _id: original._id,
      userId: ownerId,
      targetAmount: updates.targetAmount !== undefined ? parseFloat(updates.targetAmount) : original.targetAmount,
      currentAmount: updates.currentAmount !== undefined ? parseFloat(updates.currentAmount) : original.currentAmount,
      contributionAmount: updates.contributionAmount !== undefined ? parseFloat(updates.contributionAmount) : original.contributionAmount,
      updatedAt: new Date().toISOString()
    };
    updated.isCompleted = updated.currentAmount >= updated.targetAmount;
    data.goals[idx] = updated;
    writeRawData(data);
    return updated;
  },

  deleteGoal: async (userId, id) => {
    const ownerId = requireUserId(userId);
    const data = readRawData();
    if (!data.goals) data.goals = [];
    const idx = data.goals.findIndex(g => g._id === id && g.userId === ownerId);
    if (idx === -1) return null;
    data.goals.splice(idx, 1);
    writeRawData(data);
    return { success: true };
  }
};
