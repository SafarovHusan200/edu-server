// src/modules/daily-spin/dailySpin.model.js
// Har bir aylantirish tarixi — audit va "mening yutuqlarim" tarixi uchun.
// Joriy streak/kunlik limit holati User modelida saqlanadi (tez-tez o'qiladi/yoziladi).

const mongoose = require('mongoose');

const dailySpinSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // 'YYYY-MM-DD', Toshkent kalendar kuni
    date: {
      type: String,
      required: true,
    },

    diamondsWon: {
      type: Number,
      required: true,
    },

    // Shu aylantirish sodir bo'lgandagi streak qiymati — tarixiy kontekst uchun
    streakAtSpin: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

dailySpinSchema.index({ user: 1, date: 1 });

module.exports = mongoose.model('DailySpin', dailySpinSchema);
