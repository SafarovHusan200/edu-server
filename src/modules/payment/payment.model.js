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

    // 'wallet'   — user.balance ni to'ldirish
    // 'course'   — muvaffaqiyatli bo'lganda shu 'course' uchun Enrollment yaratiladi
    // 'premium'  — muvaffaqiyatli bo'lganda user.tarif='premium' bo'ladi
    // 'donation' — xayriya; muvaffaqiyatli bo'lsa ham foydalanuvchiga hech narsa berilmaydi
    purpose: {
      type: String,
      enum: ['wallet', 'course', 'premium', 'donation'],
      default: 'wallet',
    },

    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
    },

    // purpose='premium' bo'lsa qaysi reja sotib olinganini bildiradi ('30d'|'90d'|'180d'|'365d').
    // Tarixiy yozuv — narxlar keyin o'zgarsa ham qaysi reja tanlangani aniq qoladi.
    plan: {
      type: String,
      enum: ['30d', '90d', '180d', '365d', null],
      default: null,
    },

    promoCode: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PromoCode',
      default: null,
    },

    // Qo'llanilgan chegirma foizi — tarixiy yozuv, promokod keyin o'zgarsa ham to'g'ri qoladi
    discountPercent: {
      type: Number,
      default: null,
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

    // DIQQAT — vaqtinchalik diagnostika maydoni: Multicard'dan kelgan callback yoki
    // reconciliation (getInvoiceStatus) javobining XOM (raw) shakli shu yerga yoziladi.
    // Maqsad — real production'da Multicard aslida qanday maydon nomlari bilan javob
    // berayotganini SSH/log kirish huquqisiz, to'g'ridan-to'g'ri API orqali ko'rish.
    // Muammo aniqlanib, kod (masalan status maydoni mosligi) tasdiqlangach, bu
    // maydonni va uni to'ldiruvchi kodni butunlay olib tashlash mumkin/kerak.
    gatewayDebug: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
