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
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
