import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { autoCategorize } from './aiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbFilePath = path.join(__dirname, '../data/db.json');

/**
 * Dynamic Mock Data Generator for 12 months track record
 */
export function generateYearlyMockData() {
  const transactions = [];
  const budgets = [];
  const now = new Date();
  
  // Generate data for the last 12 months (inclusive of current month)
  for (let m = 11; m >= 0; m--) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - m, 15);
    const year = targetDate.getFullYear();
    const monthIndex = targetDate.getMonth();
    const monthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

    // Seed Standard Budgets for each of the 12 months
    budgets.push(
      { category: 'Food & Dining', limit: 15000, month: monthStr },
      { category: 'Transport & Auto', limit: 5000, month: monthStr },
      { category: 'Utilities & Bills', limit: 25000, month: monthStr },
      { category: 'Shopping', limit: 12000, month: monthStr },
      { category: 'Entertainment', limit: 4000, month: monthStr },
      { category: 'Healthcare & Fitness', limit: 8000, month: monthStr },
      { category: 'Education', limit: 3000, month: monthStr },
      { category: 'Travel', limit: 15000, month: monthStr }
    );

    // 1. Rent (1st of month)
    transactions.push({
      description: 'Monthly Apartment Rent',
      amount: 15000,
      category: 'Utilities & Bills',
      date: new Date(year, monthIndex, 1, 10, 0, 0).toISOString(),
      paymentMethod: 'NetBanking',
      merchant: 'Landlord Account',
      tags: ['rent', 'fixed'],
      notes: `Rent payment for ${monthStr}`
    });

    // 2. Broadband WiFi (5th of month)
    transactions.push({
      description: 'Airtel Broadband Fiber',
      amount: 999,
      category: 'Utilities & Bills',
      date: new Date(year, monthIndex, 5, 11, 30, 0).toISOString(),
      paymentMethod: 'NetBanking',
      merchant: 'Airtel Fiber',
      tags: ['internet', 'utility']
    });

    // 3. Electricity (10th of month)
    const elecBill = Math.round(1800 + Math.random() * 1200);
    transactions.push({
      description: 'BESCOM Electricity Bill',
      amount: elecBill,
      category: 'Utilities & Bills',
      date: new Date(year, monthIndex, 10, 14, 0, 0).toISOString(),
      paymentMethod: 'UPI',
      merchant: 'BESCOM India',
      tags: ['electricity', 'utility']
    });

    // 4. Netflix Subscription (15th of month)
    transactions.push({
      description: 'Netflix Premium Plan',
      amount: 649,
      category: 'Entertainment',
      date: new Date(year, monthIndex, 15, 8, 0, 0).toISOString(),
      paymentMethod: 'Card',
      merchant: 'Netflix Inc',
      tags: ['subscription', 'entertainment']
    });

    // 5. Spotify Premium (18th of month)
    transactions.push({
      description: 'Spotify Premium Duo Plan',
      amount: 179,
      category: 'Entertainment',
      date: new Date(year, monthIndex, 18, 9, 15, 0).toISOString(),
      paymentMethod: 'UPI',
      merchant: 'Spotify Music',
      tags: ['subscription', 'music']
    });

    // Weekly Groceries (4 times per month)
    const groceryMerchants = ['BigBasket', 'Reliance Smart', 'Zepto Delivery', 'Instamart'];
    for (let w = 1; w <= 4; w++) {
      const day = w * 7 - Math.floor(Math.random() * 3);
      // Don't generate dates in future for the current month
      if (m === 0 && day > now.getDate()) continue;
      
      const amt = Math.round(800 + Math.random() * 1400);
      transactions.push({
        description: 'Weekly Grocery Purchase',
        amount: amt,
        category: 'Food & Dining',
        date: new Date(year, monthIndex, day, 12, 0, 0).toISOString(),
        paymentMethod: 'UPI',
        merchant: groceryMerchants[w - 1],
        tags: ['groceries', 'household']
      });
    }

    // Swiggy / Resto Dining (5 orders per month)
    const restoMerchants = ['Meghana Foods', 'Empire Restaurant', 'Leon Grill', 'Corner House Icecreams', 'EatFit Meal'];
    for (let f = 0; f < 5; f++) {
      const day = Math.floor(1 + Math.random() * 28);
      if (m === 0 && day > now.getDate()) continue;

      const amt = Math.round(350 + Math.random() * 700);
      transactions.push({
        description: 'Food Delivery Order',
        amount: amt,
        category: 'Food & Dining',
        date: new Date(year, monthIndex, day, 20, 30, 0).toISOString(),
        paymentMethod: 'UPI',
        merchant: restoMerchants[f % restoMerchants.length],
        tags: ['food', 'dining']
      });
    }

    // Cab / Auto Commutes (6 trips per month)
    for (let t = 0; t < 6; t++) {
      const day = Math.floor(1 + Math.random() * 28);
      if (m === 0 && day > now.getDate()) continue;

      const amt = Math.round(150 + Math.random() * 350);
      transactions.push({
        description: 'Office Commute Ride',
        amount: amt,
        category: 'Transport & Auto',
        date: new Date(year, monthIndex, day, 9, 0, 0).toISOString(),
        paymentMethod: 'UPI',
        merchant: Math.random() > 0.5 ? 'Uber India' : 'Ola Cabs',
        tags: ['commute', 'cab']
      });
    }

    // Amazon / Myntra Shopping (1-2 orders per month)
    const shoppingCount = Math.random() > 0.5 ? 2 : 1;
    for (let s = 0; s < shoppingCount; s++) {
      const day = Math.floor(1 + Math.random() * 28);
      if (m === 0 && day > now.getDate()) continue;

      const amt = Math.round(800 + Math.random() * 3500);
      transactions.push({
        description: 'Online Shopping Purchase',
        amount: amt,
        category: 'Shopping',
        date: new Date(year, monthIndex, day, 16, 45, 0).toISOString(),
        paymentMethod: 'UPI',
        merchant: Math.random() > 0.4 ? 'Amazon Retail' : 'Myntra Fashion',
        tags: ['shopping', 'apparel']
      });
    }

    // Gym / Medical (every other month)
    if (monthIndex % 2 === 0) {
      const day = Math.floor(1 + Math.random() * 28);
      if (!(m === 0 && day > now.getDate())) {
        const amt = Math.round(400 + Math.random() * 1100);
        transactions.push({
          description: 'Medicine Purchase',
          amount: amt,
          category: 'Healthcare & Fitness',
          date: new Date(year, monthIndex, day, 18, 0, 0).toISOString(),
          paymentMethod: 'Cash',
          merchant: 'Apollo Pharmacy',
          tags: ['medical', 'health']
        });
      }

      const eduDay = Math.floor(1 + Math.random() * 28);
      if (!(m === 0 && eduDay > now.getDate())) {
        const amt = Math.round(389 + Math.random() * 400);
        transactions.push({
          description: 'Technical Skill Course',
          amount: amt,
          category: 'Education',
          date: new Date(year, monthIndex, eduDay, 21, 0, 0).toISOString(),
          paymentMethod: 'UPI',
          merchant: 'Udemy Web Development',
          tags: ['course', 'learning']
        });
      }
    }

    // Travel (once every 3 months)
    if (monthIndex % 3 === 0) {
      const day = Math.floor(10 + Math.random() * 15);
      if (!(m === 0 && day > now.getDate())) {
        const amt = Math.round(5500 + Math.random() * 6500);
        transactions.push({
          description: 'Weekend Getaway Outing',
          amount: amt,
          category: 'Travel',
          date: new Date(year, monthIndex, day, 7, 0, 0).toISOString(),
          paymentMethod: 'Card',
          merchant: 'MakeMyTrip Hotels',
          tags: ['travel', 'holiday']
        });
      }
    }
  }

  // Sort transactions by date descending so the newest are at the top
  const sortedTransactions = transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

  const mockSubscriptions = [
    {
      _id: 'mock-sub-1',
      description: 'Netflix Premium Plan',
      amount: 649,
      category: 'Entertainment',
      merchant: 'Netflix Inc',
      billingCycle: 'monthly',
      nextDueDate: new Date(now.getFullYear(), now.getMonth(), 15).toISOString(),
      status: 'active',
      paymentMethod: 'Card'
    },
    {
      _id: 'mock-sub-2',
      description: 'Spotify Premium Duo Plan',
      amount: 179,
      category: 'Entertainment',
      merchant: 'Spotify Music',
      billingCycle: 'monthly',
      nextDueDate: new Date(now.getFullYear(), now.getMonth(), 18).toISOString(),
      status: 'active',
      paymentMethod: 'UPI'
    },
    {
      _id: 'mock-sub-3',
      description: 'Airtel Broadband Fiber',
      amount: 999,
      category: 'Utilities & Bills',
      merchant: 'Airtel Fiber',
      billingCycle: 'monthly',
      nextDueDate: new Date(now.getFullYear(), now.getMonth(), 5).toISOString(),
      status: 'active',
      paymentMethod: 'NetBanking'
    },
    {
      _id: 'mock-sub-4',
      description: 'Monthly Apartment Rent',
      amount: 15000,
      category: 'Utilities & Bills',
      merchant: 'Landlord Account',
      billingCycle: 'monthly',
      nextDueDate: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
      status: 'active',
      paymentMethod: 'NetBanking'
    }
  ];

  return {
    transactions: sortedTransactions.map((t, idx) => ({ ...t, _id: `mock-tx-${idx + 1}` })),
    budgets: budgets.map((b, idx) => ({ ...b, _id: `mock-b-${idx + 1}` })),
    subscriptions: mockSubscriptions
  };
}

/**
 * Initialize local database file
 */
function initDb() {
  const dir = path.dirname(dbFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(dbFilePath)) {
    console.log('JSON DB Service: Creating local fallback database seed file with 12 months track record...');
    const data = generateYearlyMockData();
    fs.writeFileSync(dbFilePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`JSON DB Service: Successfully seeded ${data.transactions.length} transactions across 12 months.`);
  }
}

/**
 * Read raw data
 */
function readRawData() {
  initDb();
  try {
    const raw = fs.readFileSync(dbFilePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.subscriptions) parsed.subscriptions = [];
    return parsed;
  } catch (error) {
    console.error('JSON DB Service: Failed to read local db.json, returning empty structure.', error);
    return { transactions: [], budgets: [], subscriptions: [] };
  }
}

/**
 * Write raw data
 */
function writeRawData(data) {
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('JSON DB Service: Failed to write to local db.json', error);
  }
}

export const jsonDb = {
  // Clear database and re-seed (helper if needed)
  clearAndReSeed: () => {
    try {
      if (fs.existsSync(dbFilePath)) {
        fs.unlinkSync(dbFilePath);
      }
      initDb();
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  },

  getTransactions: async (filters) => {
    const { category, search, month } = filters;
    const data = readRawData();
    let list = [...data.transactions];

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

    // Sort by date desc
    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  createTransaction: async (txData) => {
    const { description, amount, date, paymentMethod, merchant, tags, notes, category } = txData;
    const data = readRawData();

    let finalCategory = category;
    let isAuto = false;

    if (!finalCategory || finalCategory === 'Other' || finalCategory === 'Miscellaneous') {
      const aiResult = await autoCategorize(description);
      finalCategory = aiResult.category;
      isAuto = true;
    }

    let finalMerchant = merchant;
    if (!finalMerchant) {
      const aiResult = await autoCategorize(description);
      finalMerchant = aiResult.merchant;
    }

    const newTx = {
      _id: 'mock-tx-' + Date.now(),
      description,
      amount: parseFloat(amount),
      date: date || new Date().toISOString(),
      paymentMethod: paymentMethod || 'Cash',
      category: finalCategory,
      merchant: finalMerchant,
      tags: tags || [],
      notes: notes || '',
      isAutoCategorized: isAuto,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    data.transactions.push(newTx);
    writeRawData(data);
    return newTx;
  },

  updateTransaction: async (id, updates) => {
    const data = readRawData();
    const idx = data.transactions.findIndex(t => t._id === id);
    if (idx === -1) return null;

    const original = data.transactions[idx];
    const updated = {
      ...original,
      ...updates,
      amount: updates.amount ? parseFloat(updates.amount) : original.amount,
      updatedAt: new Date().toISOString()
    };

    data.transactions[idx] = updated;
    writeRawData(data);
    return updated;
  },

  deleteTransaction: async (id) => {
    const data = readRawData();
    const idx = data.transactions.findIndex(t => t._id === id);
    if (idx === -1) return null;

    data.transactions.splice(idx, 1);
    writeRawData(data);
    return { success: true };
  },

  getBudgets: async (month) => {
    const data = readRawData();
    return data.budgets.filter(b => b.month === month);
  },

  updateBudget: async (budgetData) => {
    const { category, limit, month } = budgetData;
    const data = readRawData();
    
    const idx = data.budgets.findIndex(b => b.category === category && b.month === month);
    const limitNum = parseFloat(limit);

    let updatedBudget;
    if (idx !== -1) {
      data.budgets[idx].limit = limitNum;
      updatedBudget = data.budgets[idx];
    } else {
      updatedBudget = {
        _id: 'mock-b-' + Date.now(),
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

  getDashboardStats: async (month) => {
    const data = readRawData();
    
    // Filter transactions for this month
    const thisMonthTransactions = data.transactions.filter(t => t.date && t.date.slice(0, 7) === month);
    
    // Filter budgets for this month
    const thisMonthBudgets = data.budgets.filter(b => b.month === month);

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
    const recent = [...data.transactions]
      .filter((transaction) => transaction.date && transaction.date.slice(0, 7) === month)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    return {
      totalSpent,
      categoriesData,
      recentTransactions: recent,
      transactionCount: thisMonthTransactions.length
    };
  },

  getHistoryStats: async () => {
    const data = readRawData();
    const now = new Date();
    const history = [];

    // Calculate for the last 12 months
    for (let m = 11; m >= 0; m--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - m, 15);
      const year = targetDate.getFullYear();
      const monthIndex = targetDate.getMonth();
      const monthStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

      // Sum spent
      const monthTxs = data.transactions.filter(t => t.date && t.date.slice(0, 7) === monthStr);
      const spent = monthTxs.reduce((sum, t) => sum + t.amount, 0);

      // Sum budget limits
      const monthBudgets = data.budgets.filter(b => b.month === monthStr);
      const budgetLimit = monthBudgets.reduce((sum, b) => sum + b.limit, 0);

      // Get month label (e.g. "Jul 25")
      const monthLabel = targetDate.toLocaleString('default', { month: 'short', year: '2-digit' });

      history.push({
        month: monthStr,
        label: monthLabel,
        spent: Math.round(spent),
        budget: Math.round(budgetLimit)
      });
    }

    return history;
  },

  getAllBudgets: async () => {
    const data = readRawData();
    return data.budgets;
  },

  applyBulkBudgets: async (budgetsList) => {
    const data = readRawData();
    budgetsList.forEach(b => {
      const idx = data.budgets.findIndex(x => x.category === b.category && x.month === b.month);
      const limitNum = parseFloat(b.limit);
      if (idx !== -1) {
        data.budgets[idx].limit = limitNum;
        data.budgets[idx].updatedAt = new Date().toISOString();
      } else {
        data.budgets.push({
          _id: 'mock-b-' + (Date.now() + Math.random()),
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

  getSubscriptions: async () => {
    const data = readRawData();
    return data.subscriptions || [];
  },

  createSubscription: async (subData) => {
    const data = readRawData();
    const newSub = {
      _id: 'mock-sub-' + (Date.now() + Math.random()),
      status: 'active',
      ...subData,
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

  updateSubscription: async (id, updates) => {
    const data = readRawData();
    if (!data.subscriptions) data.subscriptions = [];
    const idx = data.subscriptions.findIndex(s => s._id === id);
    if (idx === -1) return null;
    const original = data.subscriptions[idx];
    const updated = {
      ...original,
      ...updates,
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

  deleteSubscription: async (id) => {
    const data = readRawData();
    if (!data.subscriptions) data.subscriptions = [];
    const idx = data.subscriptions.findIndex(s => s._id === id);
    if (idx === -1) return null;
    data.subscriptions.splice(idx, 1);
    writeRawData(data);
    return { success: true };
  },

  bulkUpdateSubscriptions: async (subsList) => {
    const data = readRawData();
    data.subscriptions = subsList;
    writeRawData(data);
    return { success: true };
  }
};
