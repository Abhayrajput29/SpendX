import Transaction from '../models/Transaction.js';
import Budget from '../models/Budget.js';
import { generateYearlyMockData } from './jsonDbService.js';

export async function seedDatabase() {
  try {
    const txCount = await Transaction.countDocuments();
    if (txCount === 0) {
      console.log('Seed Service: No transactions found in MongoDB. Seeding 12 months track record...');
      
      const seedData = generateYearlyMockData();
      
      // Strip mock string _ids so MongoDB generates native ObjectIds
      const mongoTransactions = seedData.transactions.map(({ _id, ...rest }) => rest);
      const mongoBudgets = seedData.budgets.map(({ _id, ...rest }) => rest);

      await Transaction.insertMany(mongoTransactions);
      
      // Clean budgets for these months and insert fresh ones
      const months = Array.from(new Set(seedData.budgets.map(b => b.month)));
      await Budget.deleteMany({ month: { $in: months } });
      await Budget.insertMany(mongoBudgets);

      console.log(`=== Seed Service: MongoDB successfully seeded with ${mongoTransactions.length} records across 12 months in Rupees (₹) ===`);
    } else {
      console.log(`Seed Service: MongoDB already populated with ${txCount} records. Skipping seed.`);
    }
  } catch (error) {
    console.error('Seed Service: Seeding operation failed:', error);
  }
}
