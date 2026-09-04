import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true
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
  }
}, {
  timestamps: true
});

export default mongoose.model('Transaction', TransactionSchema);
