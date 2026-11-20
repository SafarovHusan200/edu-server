// src/modules/user-activity/userActivity.model.js
// Hisob bilan bog'liq muhim hodisalar jurnali (kirishlar, admin amallari).
// Faqat userActivity.service.logActivity() orqali yoziladi. Parol/token kabi maxfiy
// qiymatlar meta'ga HECH QACHON yozilmaydi.

const mongoose = require('mongoose');

const ACTIVITY_TYPES = [
  'login', // { ip, userAgent, method }
  'register', // { via }
  'verified',
  'blocked',
  'unblocked',
  'role_changed', // { from, to }
  'tarif_changed', // { from, to, expiresAt }
  'grade_changed', // { from: "4-B", to: "5-B" }
  'password_reset',
  'avatar_removed',
  'profile_updated', // { fields: ["name", "phone"] }
];

const userActivitySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    // Amalni kim qilgani; foydalanuvchining o'zi yoki tizim bo'lsa null
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false }
);

userActivitySchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('UserActivity', userActivitySchema);
module.exports.ACTIVITY_TYPES = ACTIVITY_TYPES;
