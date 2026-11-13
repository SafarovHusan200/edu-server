// src/jobs/paymentDraft.scheduler.js
// Eski "draft" to'lovlarni Multicard'da tekshirib, to'lanmaganlarini 'expired' qiladigan
// cron vazifasi (logika — payment.service.js expireStaleDrafts). server.js'da bir marta chaqiriladi.

const cron = require('node-cron');
const { expireStaleDrafts } = require('../modules/payment/payment.service');
const {
  DRAFT_CLEANUP_ENABLED,
  DRAFT_CLEANUP_CRON,
  DRAFT_EXPIRE_MINUTES,
} = require('../config/payment');

let running = false;

const runDraftCleanup = async () => {
  // Oldingi ishga tushish hali tugamagan bo'lsa (Multicard sekin javob bersa) — ustma-ust ishlatmaymiz
  if (running) return;
  running = true;

  try {
    const result = await expireStaleDrafts();
    if (result.checked > 0) {
      console.log(
        `🧹 Draft to'lovlar tekshirildi: ${result.checked} ta — expired: ${result.expired}, ` +
          `aslida to'langan: ${result.succeeded}, boshqa holat: ${result.otherStatus}, xato: ${result.failed}`
      );
    }
  } catch (error) {
    console.error('❌ Draft to\'lovlarni tozalash xatosi:', error.message);
  } finally {
    running = false;
  }
};

const startPaymentDraftScheduler = () => {
  if (!DRAFT_CLEANUP_ENABLED) {
    console.log("ℹ️ Draft to'lovlarni tozalash o'chirilgan (PAYMENT_DRAFT_CLEANUP_ENABLED=false)");
    return;
  }

  cron.schedule(DRAFT_CLEANUP_CRON, runDraftCleanup, { timezone: 'Asia/Tashkent' });
  console.log(
    `🧹 Draft to'lovlarni tozalash jadvali: "${DRAFT_CLEANUP_CRON}" (${DRAFT_EXPIRE_MINUTES} daqiqadan eskilari)`
  );
};

module.exports = { startPaymentDraftScheduler, runDraftCleanup };
