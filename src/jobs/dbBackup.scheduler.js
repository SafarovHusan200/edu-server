// src/jobs/dbBackup.scheduler.js
// Har kuni belgilangan vaqtda bazadan JSON zaxira olib, Telegram orqali
// yuboradigan cron vazifasi. server.js'da bir marta chaqiriladi.

const cron = require('node-cron');
const { createBackupBuffer } = require('./dbBackup.service');
const { ENABLED, CRON, TELEGRAM_CHAT_ID } = require('../config/backup');

const formatMb = (bytes) => (bytes / 1024 / 1024).toFixed(2);

const runBackupAndSend = async () => {
  if (!TELEGRAM_CHAT_ID) {
    console.error(
      "⚠️ DB_BACKUP_TELEGRAM_CHAT_ID sozlanmagan — zaxira Telegram'ga yuborilmadi"
    );
    return;
  }

  try {
    const { buffer, sizeBytes, collectionCount, documentCount } = await createBackupBuffer();

    // Lazy require — bot.js'ni faqat haqiqatan yuborish kerak bo'lganda yuklaymiz
    // (telegramNotifier.js'dagi bilan bir xil naqsh, keraksiz require zanjiridan qochish uchun)
    const bot = require('../bot/bot');
    const dateStr = new Date().toISOString().slice(0, 10);

    await bot.sendDocument(
      TELEGRAM_CHAT_ID,
      buffer,
      {
        caption:
          `🗄 <b>Kunlik ma'lumotlar bazasi zaxirasi</b>\n📅 ${dateStr}\n` +
          `📦 ${collectionCount} ta kolleksiya, ${documentCount} ta hujjat\n` +
          `💾 Hajmi: ${formatMb(sizeBytes)} MB\n\n` +
          `Tiklash uchun: <code>node scripts/restoreBackup.js backup-${dateStr}.json.gz --yes</code>`,
        parse_mode: 'HTML',
      },
      { filename: `backup-${dateStr}.json.gz`, contentType: 'application/gzip' }
    );

    console.log(`✅ DB zaxira Telegram'ga yuborildi (${dateStr}, ${formatMb(sizeBytes)} MB)`);
  } catch (error) {
    console.error('❌ DB zaxira xatosi:', error.message);
  }
};

const startBackupScheduler = () => {
  if (!ENABLED) {
    console.log("ℹ️ Kunlik DB zaxira o'chirilgan (DB_BACKUP_ENABLED=true qiling, yoqish uchun)");
    return;
  }

  cron.schedule(CRON, runBackupAndSend, { timezone: 'Asia/Tashkent' });
  console.log(`🗄 Kunlik DB zaxira jadvali faollashtirildi: "${CRON}" (Toshkent vaqti)`);
};

module.exports = { startBackupScheduler, runBackupAndSend };
