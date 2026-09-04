import mongoose from 'mongoose';

const SubscriptionSchema = new mongoose.Schema({
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
  merchant: {
    type: String,
    trim: true,
    default: ''
  },
  billingCycle: {
    type: String,
    enum: ['weekly', 'monthly', 'yearly'],
    default: 'monthly'
  },
  nextDueDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'cancelled', 'completed'],
    default: 'active'
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Card', 'UPI', 'NetBanking', 'Other'],
    default: 'Card'
  },
  isEMI: {
    type: Boolean,
    default: false
  },
  tenureMonths: {
    type: Number,
    default: null
  },
  remainingMonths: {
    type: Number,
    default: null
  }
}, {
  timestamps: true
});

export default mongoose.model('Subscription', SubscriptionSchema);
