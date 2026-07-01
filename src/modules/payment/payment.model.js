// src/modules/payment/payment.model.js

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    invoiceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    multicardUuid: {
      type: String,
      default: null,
    },

    amount: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ['draft', 'progress', 'billing', 'hold', 'success', 'error', 'revert'],
      default: 'draft',
    },

    receiptUrl: {
      type: String,
      default: null,
    },

    cardPan: {
      type: String,
      default: null,
    },

    paymentTime: {
      type: Date,
      default: null,
    },

    callbackReceivedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
