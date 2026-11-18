// src/jobs/dbBackup.scheduler.js
// Har kuni belgilangan vaqtda bazadan JSON zaxira olib, Telegram orqali
// yuboradigan cron vazifasi. server.js'da bir marta chaqiriladi.
//
// - Xato bo'lsa (zaxira yaratish yoki yuborish) — shu chatga "❌" xabari yuboriladi,
//   aks holda zaxira haftalab jim to'xtab qolishi mumkin edi.
// - Telegram Bot API fayl limiti 50 MB. Fayl PART_SIZE dan katta bo'lsa —
//   "backup-<sana>.json.gz.part1-of-3" ko'rinishidagi bo'laklarga bo'lib yuboriladi
//   (scripts/restoreBackup.js ularni o'zi birlashtiradi). WARN_SIZE dan oshsa —
//   izohda ogohlantirish chiqadi.

const cron = require('node-cron');
const { createBackupBuffer } = require('./dbBackup.service');
const { ENABLED, CRON, TELEGRAM_CHAT_ID } = require('../config/backup');

const MB = 1024 * 1024;
// 50 MB limitdan multipart sarlavhalari uchun zaxira qoldiriladi
const PART_SIZE = 45 * MB;
const WARN_SIZE = 40 * MB;

const formatMb = (bytes) => (bytes / MB).toFixed(2);

const escapeHtml = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const splitBuffer = (buffer, partSize) => {
  const parts = [];
  for (let offset = 0; offset < buffer.length; offset += partSize) {
    parts.push(buffer.subarray(offset, offset + partSize));
  }
  return parts;
};

// Lazy require — bot.js'ni faqat haqiqatan yuborish kerak bo'lganda yuklaymiz
// (telegramNotifier.js'dagi bilan bir xil naqsh, keraksiz require zanjiridan qochish uchun)
const getBot = () => require('../bot/bot');

const notifyFailure = async (chatId, dateStr, error) => {
  try {
    await getBot().sendMessage(
      chatId,
      `❌ <b>Kunlik DB zaxirasi yuborilmadi</b>\n📅 ${dateStr}\n\n` +
        `Sabab: <code>${escapeHtml(String(error?.message || error).slice(0, 500))}</code>\n\n` +
        "Server logini tekshiring. Keyingi urinish — navbatdagi jadval vaqtida.",
      { parse_mode: 'HTML' }
    );
  } catch (notifyError) {
    console.error("❌ DB zaxira xatosi haqidagi xabarni ham yuborib bo'lmadi:", notifyError.message);
  }
};

/**
 * @param {{ partSize?: number, warnSize?: number }} [options] — faqat testlar uchun
 */
const runBackupAndSend = async ({ partSize = PART_SIZE, warnSize = WARN_SIZE } = {}) => {
  if (!TELEGRAM_CHAT_ID) {
    console.error(
      "⚠️ DB_BACKUP_TELEGRAM_CHAT_ID sozlanmagan — zaxira Telegram'ga yuborilmadi"
    );
    return;
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const baseName = `backup-${dateStr}.json.gz`;

  try {
    const { buffer, sizeBytes, collectionCount, documentCount } = await createBackupBuffer();
    const bot = getBot();

    const parts = splitBuffer(buffer, partSize);
    const total = parts.length;
    const fileNames =
      total === 1 ? [baseName] : parts.map((_, i) => `${baseName}.part${i + 1}-of-${total}`);

    const warning =
      sizeBytes >= warnSize
        ? `\n\n⚠️ <b>Zaxira hajmi katta</b> (Telegram limiti 50 MB)` +
          (total > 1 ? ` — ${total} ta bo'lakka bo'lindi, hammasini saqlang.` : ' — tez orada bo\'laklarga bo\'linadi.')
        : '';

    // Bo'laklar bo'lsa ham buyruq bir xil — skript yonidagi .partK-of-N fayllarni o'zi topadi
    const restoreCmd = `node scripts/restoreBackup.js ${baseName} --yes`;
    const restoreHint = total > 1 ? `\n(${total} ta bo'lakni bitta papkaga saqlang)` : '';

    for (let i = 0; i < total; i += 1) {
      const partLabel = total > 1 ? `\n🧩 Bo'lak ${i + 1}/${total}` : '';
      // To'liq izoh faqat birinchi bo'lakda — qolganlarida qisqa
      const caption =
        i === 0
          ? `🗄 <b>Kunlik ma'lumotlar bazasi zaxirasi</b>\n📅 ${dateStr}${partLabel}\n` +
            `📦 ${collectionCount} ta kolleksiya, ${documentCount} ta hujjat\n` +
            `💾 Hajmi: ${formatMb(sizeBytes)} MB${warning}\n\n` +
            `Tiklash uchun: <code>${restoreCmd}</code>${restoreHint}`
          : `🗄 DB zaxirasi ${dateStr}${partLabel}`;

      // Bo'laklar tartib bilan yuboriladi (parallel emas)
      await bot.sendDocument(
        TELEGRAM_CHAT_ID,
        parts[i],
        { caption, parse_mode: 'HTML' },
        { filename: fileNames[i], contentType: 'application/gzip' }
      );
    }

    console.log(
      `✅ DB zaxira Telegram'ga yuborildi (${dateStr}, ${formatMb(sizeBytes)} MB, ${total} ta fayl)`
    );
  } catch (error) {
    console.error('❌ DB zaxira xatosi:', error.message);
    await notifyFailure(TELEGRAM_CHAT_ID, dateStr, error);
  }
};

const startBackupScheduler = () => {
  if (!ENABLED) {
    console.log("ℹ️ Kunlik DB zaxira o'chirilgan (DB_BACKUP_ENABLED=true qiling, yoqish uchun)");
    return;
  }

  cron.schedule(CRON, () => runBackupAndSend(), { timezone: 'Asia/Tashkent' });
  console.log(`🗄 Kunlik DB zaxira jadvali faollashtirildi: "${CRON}" (Toshkent vaqti)`);
};

module.exports = { startBackupScheduler, runBackupAndSend, splitBuffer, PART_SIZE, WARN_SIZE };
