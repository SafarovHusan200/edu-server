// src/config/payment.js
// "draft" (Multicard invoysi ochilgan, lekin to'lanmagan) to'lovlarni boshqarish sozlamalari

const toInt = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

module.exports = {
  // Default: yoqilgan — o'chirish uchun .env'da PAYMENT_DRAFT_CLEANUP_ENABLED=false
  DRAFT_CLEANUP_ENABLED: process.env.PAYMENT_DRAFT_CLEANUP_ENABLED !== 'false',

  // Cron ifodasi — default: har 30 daqiqada (Toshkent vaqti)
  DRAFT_CLEANUP_CRON: process.env.PAYMENT_DRAFT_CLEANUP_CRON || '*/30 * * * *',

  // Shuncha daqiqadan eski draft Multicard'da tekshiriladi va to'lanmagan bo'lsa 'expired' qilinadi
  DRAFT_EXPIRE_MINUTES: toInt(process.env.PAYMENT_DRAFT_EXPIRE_MINUTES, 60),

  // Bitta ishga tushishda ko'pi bilan shuncha draft tekshiriladi (Multicard'ni ortiqcha yuklamaslik uchun)
  DRAFT_CLEANUP_BATCH: toInt(process.env.PAYMENT_DRAFT_CLEANUP_BATCH, 200),

  // Foydalanuvchi bir xil to'lovni shu daqiqa ichida qayta boshlasa — yangi invoys ochilmaydi,
  // eski draftning checkoutUrl'i qaytariladi. DRAFT_EXPIRE_MINUTES'dan kichik bo'lishi kerak.
  DRAFT_REUSE_MINUTES: toInt(process.env.PAYMENT_DRAFT_REUSE_MINUTES, 15),
};
