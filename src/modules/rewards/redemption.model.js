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

    // pending → (admin ko'rib chiqadi) → approved → (mukofot qo'lga topshiriladi) → delivered
    // pending yoki approved holatidan rejected'ga o'tishi ham mumkin
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'delivered'],
      default: 'pending',
    },

    // Bosqich 1: ko'rib chiqib tasdiqlash — qaysi admin, qachon
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },

    // Rad etish (pending yoki approved holatidan) — qaysi admin, qachon, sababi
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    rejectReason: {
      type: String,
      trim: true,
      default: '',
    },

    // Bosqich 2 (yakuniy): mukofot studentga jismonan topshirilgani — qaysi admin, qachon
    deliveredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    deliveryNote: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

redemptionSchema.index({ student: 1, createdAt: -1 });

module.exports = mongoose.model('RewardRedemption', redemptionSchema);
