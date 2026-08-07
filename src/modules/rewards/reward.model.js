// src/modules/rewards/reward.model.js

const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: '',
    },

    image: {
      type: String,
      default: null,
    },

    // Diamonddagi narxi
    cost: {
      type: Number,
      required: true,
      min: 1,
    },

    // null = cheksiz miqdor, aks holda qolgan sonini bildiradi
    stock: {
      type: Number,
      default: null,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Reward', rewardSchema);
