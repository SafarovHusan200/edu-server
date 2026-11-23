// src/modules/auth/otp.model.js

const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  telegramId: {
    type: Number,
    required: true,
  },

  code: {
    type: String,
    required: true,
  },

  // "Saytda kirish" havolasidagi uzun token (otp.service.js) — eski yozuvlarda bo'lmaydi
  linkToken: {
    type: String,
    default: null,
  },

  expiresAt: {
    type: Date,
    required: true,
  },

  isUsed: {
    type: Boolean,
    default: false,
  },
});

// TTL index — expiresAt o'tgandan keyin MongoDB avtomatik o'chiradi
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ code: 1 });
otpSchema.index({ linkToken: 1 });
otpSchema.index({ telegramId: 1 });

module.exports = mongoose.model('Otp', otpSchema);
