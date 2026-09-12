import mongoose from 'mongoose';

const GoalSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  targetAmount: {
    type: Number,
    required: true,
    min: 1
  },
  currentAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  targetDate: {
    type: String,
    required: true
  },
  frequency: {
    type: String,
    enum: ['Weekly', 'Monthly', 'Yearly'],
    default: 'Monthly'
  },
  contributionAmount: {
    type: Number,
    default: 0
  },
  category: {
    type: String,
    default: 'General'
  },
  color: {
    type: String,
    default: '#866ec7'
  },
  notes: {
    type: String,
    default: ''
  },
  isCompleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

export default mongoose.model('Goal', GoalSchema);
