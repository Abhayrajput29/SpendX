import Transaction from '../models/Transaction.js';
import Subscription from '../models/Subscription.js';
import { jsonDb } from './jsonDbService.js';

/**
 * Heuristically detects candidate subscriptions from historical ledger logs.
 * @param {Array} transactions 
 * @returns {Array} List of candidate subscriptions
 */
export function detectRecurringPayments(transactions) {
  if (transactions.length < 2) return [];

  // Group transactions by a normalized description
  const groups = {};
  transactions.forEach(t => {
    // Normalize: lowercase, remove digits, remove common punctuation, trim
    const normalized = t.description
      .toLowerCase()
      .replace(/[0-9]+/g, '')
      .replace(/rent for.*/g, 'rent')
      .replace(/payment for.*/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (normalized.length < 3) return;

    if (!groups[normalized]) {
      groups[normalized] = [];
    }
    groups[normalized].push(t);
  });

  const candidates = [];

  Object.keys(groups).forEach(name => {
    const list = groups[name].sort((a, b) => new Date(a.date) - new Date(b.date));
    if (list.length < 2) return;

    // Calculate dates differences in days
    const diffs = [];
    const amounts = [];
    
    for (let i = 1; i < list.length; i++) {
      const d1 = new Date(list[i - 1].date);
      const d2 = new Date(list[i].date);
      const diffTime = Math.abs(d2 - d1);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      diffs.push(diffDays);
      amounts.push(list[i].amount);
    }
    
    // Add the first item's amount to keep variance calculations complete
    amounts.push(list[0].amount);

    // Calculate average gap
    const avgDiff = diffs.reduce((sum, d) => sum + d, 0) / diffs.length;
    const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    
    // Check variance of amounts (max difference from average should be within 15%)
    const amtVariance = amounts.every(a => Math.abs(a - avgAmount) / avgAmount < 0.15);
    
    // Determine billing cycle
    let billingCycle = null;
    let isRecurring = false;

    // Monthly: average gap is between 26 and 35 days
    if (avgDiff >= 26 && avgDiff <= 35) {
      billingCycle = 'monthly';
      isRecurring = true;
    } 
    // Weekly: average gap is between 6 and 8 days
    else if (avgDiff >= 6 && avgDiff <= 8) {
      billingCycle = 'weekly';
      isRecurring = true;
    }
    // Yearly: average gap is between 350 and 380 days
    else if (avgDiff >= 350 && avgDiff <= 380) {
      billingCycle = 'yearly';
      isRecurring = true;
    }

    // Only suggest if amounts are stable, it is recurring, and total transaction amount isn't trivial
    if (isRecurring && amtVariance && avgAmount >= 100) {
      const lastTx = list[list.length - 1];
      
      // Calculate next recommended due date based on last billing transaction
      const lastTxDate = new Date(lastTx.date);
      let nextDueDate = new Date(lastTxDate);
      if (billingCycle === 'monthly') {
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      } else if (billingCycle === 'weekly') {
        nextDueDate.setDate(nextDueDate.getDate() + 7);
      } else if (billingCycle === 'yearly') {
        nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
      }

      candidates.push({
        description: list[0].description, // use original description
        amount: Math.round(avgAmount),
        category: lastTx.category,
        merchant: lastTx.merchant || '',
        billingCycle,
        nextDueDate: nextDueDate.toISOString(),
        status: 'active',
        paymentMethod: lastTx.paymentMethod || 'Card',
        frequencyCount: list.length
      });
    }
  });

  return candidates;
}

/**
 * Iterates through all active subscriptions and creates ledger transactions if they fall due.
 * Runs on backend start or can be manually triggered.
 */
export async function checkAndLogDueSubscriptions(jsonDbMode = false) {
  const now = new Date();
  let subscriptions = [];
  
  if (jsonDbMode) {
    subscriptions = await jsonDb.getSubscriptions();
  } else {
    subscriptions = await Subscription.find({ status: 'active' });
  }

  let loggedCount = 0;
  const updatedSubscriptions = [];

  for (let sub of subscriptions) {
    if (sub.status !== 'active') continue;

    let subDate = new Date(sub.nextDueDate);
    let modified = false;

    // Check if subscription has fallen due (potentially multiple times if missed long duration)
    while (subDate <= now) {
      // 1. Create a ledger transaction representing this invoice bill
      const newTxData = {
        description: `Recurring: ${sub.description}`,
        amount: sub.amount,
        category: sub.category,
        merchant: sub.merchant || 'Auto Subscription',
        paymentMethod: sub.paymentMethod || 'Card',
        date: new Date(subDate).toISOString(),
        notes: `Automatically recorded via subscription scheduler.`,
        tags: ['subscription', 'recurring']
      };

      if (jsonDbMode) {
        await jsonDb.createTransaction(newTxData);
      } else {
        const tx = new Transaction(newTxData);
        await tx.save();
      }

      loggedCount++;
      modified = true;

      // Decrement remainingMonths if this is an EMI
      if (sub.isEMI && sub.remainingMonths !== null && sub.remainingMonths !== undefined) {
        sub.remainingMonths = Math.max(0, sub.remainingMonths - 1);
        if (sub.remainingMonths === 0) {
          sub.status = 'completed';
          break; // Stop billing further
        }
      }

      // 2. Advance the nextDueDate
      if (sub.billingCycle === 'monthly') {
        subDate.setMonth(subDate.getMonth() + 1);
      } else if (sub.billingCycle === 'weekly') {
        subDate.setDate(subDate.getDate() + 7);
      } else if (sub.billingCycle === 'yearly') {
        subDate.setFullYear(subDate.getFullYear() + 1);
      }
    }

    if (modified) {
      sub.nextDueDate = subDate.toISOString();
      const updates = {
        nextDueDate: sub.nextDueDate,
        remainingMonths: sub.remainingMonths,
        status: sub.status
      };
      if (jsonDbMode) {
        await jsonDb.updateSubscription(sub._id, updates);
      } else {
        // Mongoose save
        await Subscription.findByIdAndUpdate(sub._id, updates);
      }
    }
  }

  return {
    success: true,
    loggedTransactionsCount: loggedCount
  };
}
