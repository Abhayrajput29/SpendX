import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01,
    validate: Number.isFinite
  },
  category: {
    type: String,
    required: true,
    default: 'Other'
  },
  date: {
    type: Date,
    default: Date.now
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Card', 'UPI', 'NetBanking', 'Other'],
    default: 'Cash'
  },
  merchant: {
    type: String,
    trim: true,
    default: ''
  },
  receiptUrl: {
    type: String,
    default: ''
  },
  ocrData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  tags: {
    type: [String],
    default: []
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  isAutoCategorized: {
    type: Boolean,
    default: false
  },
  schedulerKey: {
    type: String,
    maxlength: 300,
    immutable: true,
    select: false
  }
}, {
  timestamps: true
});

TransactionSchema.index({ userId: 1, date: -1 });
TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index({ userId: 1, schedulerKey: 1 }, {
  unique: true,
  partialFilterExpression: { schedulerKey: { $type: 'string' } }
});

export default mongoose.model('Transaction', TransactionSchema);
