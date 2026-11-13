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

    // 'multicard' — Multicard checkout orqali karta bilan to'langan
    // 'balance'   — user.balance (hamyon)dan to'g'ridan-to'g'ri yechilgan, Multicard'ga chiqilmagan
    method: {
      type: String,
      enum: ['multicard', 'balance'],
      default: 'multicard',
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

    // draft..revert — Multicard statuslari. 'expired' — bizning o'zimizniki: draft uzoq vaqt
    // to'lanmay qolgani Multicard'da tekshirilgach (jobs/paymentDraft.scheduler.js) qo'yiladi.
    // Yozuv o'chirilmaydi — kechikib kelgan callback baribir 'success'ga o'tkaza oladi.
    status: {
      type: String,
      enum: ['draft', 'progress', 'billing', 'hold', 'success', 'error', 'revert', 'expired'],
      default: 'draft',
    },

    // Multicard checkout sahifasi — bir xil to'lov qayta boshlanganda yangi invoys
    // ochmasdan shu havolani qaytarish uchun saqlanadi (createPayment'ga qarang)
    checkoutUrl: {
      type: String,
      default: null,
    },

    // Invoys ochilgandagi return_url — draft faqat bir xil return_url bo'lsa qayta
    // ishlatiladi (foydalanuvchi to'lovdan keyin to'g'ri sahifaga qaytishi uchun)
    returnUrl: {
      type: String,
      default: null,
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

// Draft cleanup job va draftni qayta ishlatish so'rovlari uchun
paymentSchema.index({ status: 1, createdAt: 1 });
paymentSchema.index({ user: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
