import test from 'node:test';
import assert from 'node:assert/strict';
import { jsonDb } from '../services/jsonDbService.js';
import { autoCategorize, CATEGORIES } from '../services/aiService.js';
import { detectRecurringPayments } from '../services/subscriptionService.js';
import { generateForecast } from '../services/forecastService.js';

test('autoCategorize assigns categories accurately based on rules and keywords', async () => {
  const grocery = await autoCategorize('Whole Foods Supermarket groceries');
  assert.equal(grocery.category, 'Food & Dining');

  const ride = await autoCategorize('Uber trip downtown');
  assert.equal(ride.category, 'Transport & Auto');

  const utility = await autoCategorize('Airtel Broadband Fiber recharge');
  assert.equal(utility.category, 'Utilities & Bills');

  const shopping = await autoCategorize('Amazon shopping electronics order');
  assert.equal(shopping.category, 'Shopping');

  const netflix = await autoCategorize('Netflix subscription monthly');
  assert.equal(netflix.category, 'Entertainment');
});

test('CATEGORIES list contains standard expected expense categories', () => {
  assert.ok(CATEGORIES.includes('Food & Dining'));
  assert.ok(CATEGORIES.includes('Transport & Auto'));
  assert.ok(CATEGORIES.includes('Utilities & Bills'));
  assert.ok(CATEGORIES.includes('Shopping'));
  assert.ok(CATEGORIES.includes('Miscellaneous'));
});

test('jsonDb transactions CRUD operations function properly', async () => {
  const uniqueDesc = `Test Transaction ${Date.now()}`;
  const newTx = await jsonDb.createTransaction({
    description: uniqueDesc,
    amount: 125.50,
    category: 'Food & Dining',
    paymentMethod: 'Credit Card',
    merchant: 'Test Bistro',
    date: new Date().toISOString()
  });

  assert.ok(newTx._id || newTx.id);
  assert.equal(newTx.amount, 125.50);
  assert.equal(newTx.description, uniqueDesc);

  // Read transactions
  const allTx = await jsonDb.getTransactions({ search: uniqueDesc });
  assert.ok(Array.isArray(allTx));
  const found = allTx.find(t => t.description === uniqueDesc);
  assert.ok(found);

  // Update transaction
  const updatedTx = await jsonDb.updateTransaction(newTx._id || newTx.id, {
    notes: 'Updated via test suite'
  });
  assert.equal(updatedTx.notes, 'Updated via test suite');

  // Delete transaction
  const deleted = await jsonDb.deleteTransaction(newTx._id || newTx.id);
  assert.ok(deleted);
});

test('jsonDb budgets operations allow setting and fetching budget limits', async () => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const budgets = await jsonDb.getBudgets(currentMonth);
  assert.ok(Array.isArray(budgets));

  const updated = await jsonDb.updateBudget({
    category: 'Food & Dining',
    limit: 18000,
    month: currentMonth
  });
  assert.equal(updated.category, 'Food & Dining');
  assert.equal(updated.limit, 18000);
});

test('jsonDb goals operations support creating and contributing to savings goals', async () => {
  const goalTitle = `Test Savings Goal ${Date.now()}`;
  const goal = await jsonDb.createGoal({
    title: goalTitle,
    targetAmount: 5000,
    currentAmount: 1000,
    category: 'Emergency Fund',
    targetDate: '2027-12-31'
  });

  assert.ok(goal._id);
  assert.equal(goal.targetAmount, 5000);

  // Update goal (contribution)
  const updated = await jsonDb.updateGoal(goal._id, { currentAmount: 1500 });
  assert.equal(updated.currentAmount, 1500);

  // Cleanup
  await jsonDb.deleteGoal(goal._id);
});

test('jsonDb subscriptions support recurring active records', async () => {
  const subName = `Test Streaming Sub ${Date.now()}`;
  const sub = await jsonDb.createSubscription({
    name: subName,
    amount: 199,
    billingCycle: 'monthly',
    category: 'Entertainment',
    nextBillingDate: '2026-10-01'
  });

  assert.ok(sub._id);
  assert.equal(sub.name, subName);

  const allSubs = await jsonDb.getSubscriptions();
  assert.ok(allSubs.some(s => s.name === subName));

  await jsonDb.deleteSubscription(sub._id);
});

test('detectRecurringPayments identifies regular repeating transactions', async () => {
  const sampleTransactions = [
    { description: 'Gym Membership', amount: 1500, date: '2026-06-01', category: 'Healthcare & Fitness' },
    { description: 'Gym Membership', amount: 1500, date: '2026-07-01', category: 'Healthcare & Fitness' },
    { description: 'Gym Membership', amount: 1500, date: '2026-08-01', category: 'Healthcare & Fitness' },
    { description: 'Random Coffee', amount: 150, date: '2026-08-15', category: 'Food & Dining' }
  ];

  const recurring = detectRecurringPayments(sampleTransactions);
  assert.ok(Array.isArray(recurring));
  const gym = recurring.find(r => r.description.toLowerCase().includes('gym'));
  assert.ok(gym);
  assert.equal(gym.amount, 1500);
});

test('generateForecast produces future budget and spending projections', async () => {
  const sampleTransactions = [
    { description: 'Rent', amount: 15000, date: '2026-01-01', category: 'Utilities & Bills' },
    { description: 'Groceries', amount: 4000, date: '2026-01-15', category: 'Food & Dining' }
  ];
  const forecast = await generateForecast(sampleTransactions, []);
  assert.ok(forecast);
  assert.ok(Array.isArray(forecast.historical));
  assert.ok(Array.isArray(forecast.projected));
  assert.ok(typeof forecast.trend === 'string');
});
