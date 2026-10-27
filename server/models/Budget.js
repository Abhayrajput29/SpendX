import mongoose from 'mongoose';

const BudgetSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  limit: {
    type: Number,
    required: true,
    min: 0.01,
    validate: Number.isFinite
  },
  month: {
    type: String,
    required: true,
    match: /^\d{4}-(0[1-9]|1[0-2])$/
  }
}, {
  timestamps: true
});

// Avoid duplicate budgets per user, category, and month
BudgetSchema.index({ userId: 1, category: 1, month: 1 }, { unique: true });
BudgetSchema.index({ userId: 1, month: 1 });

export default mongoose.model('Budget', BudgetSchema);
