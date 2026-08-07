// src/modules/auth/telegramLinkToken.model.js
// Profil sahifasidan "Telegramni ulash" tugmasi bosilganda generatsiya qilinadigan
// bir martalik token — bot deep-link (t.me/<bot>?start=<token>) orqali hisobni bog'laydi.

const mongoose = require('mongoose');

const telegramLinkTokenSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  token: {
    type: String,
    required: true,
    unique: true,
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
telegramLinkTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('TelegramLinkToken', telegramLinkTokenSchema);
