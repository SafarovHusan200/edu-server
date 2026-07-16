// src/modules/promocodes/promocode.model.js

const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    discountPercent: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },

    // null = muddatsiz
    expiresAt: {
      type: Date,
      default: null,
    },

    // null = cheksiz, 1 = bir martalik
    maxUses: {
      type: Number,
      default: null,
      min: 1,
    },

    usedCount: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PromoCode', promoCodeSchema);
