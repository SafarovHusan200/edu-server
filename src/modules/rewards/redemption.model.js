// src/modules/rewards/redemption.model.js

const mongoose = require('mongoose');

const redemptionSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    reward: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reward',
      required: true,
    },

    // Redemption vaqtidagi narx — reward.cost keyin o'zgarsa ham tarix to'g'ri qoladi
    diamondsSpent: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ['pending', 'delivered', 'rejected'],
      default: 'pending',
    },

    adminNote: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

redemptionSchema.index({ student: 1, createdAt: -1 });

module.exports = mongoose.model('RewardRedemption', redemptionSchema);
