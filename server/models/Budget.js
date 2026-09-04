import mongoose from 'mongoose';

const BudgetSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    trim: true
  },
  limit: {
    type: Number,
    required: true
  },
  month: {
    type: String,
    required: true, // Formatted as YYYY-MM (e.g. '2026-06')
  }
}, {
  timestamps: true
});

// Avoid duplicate budgets for the same category in the same month
BudgetSchema.index({ category: 1, month: 1 }, { unique: true });

export default mongoose.model('Budget', BudgetSchema);
