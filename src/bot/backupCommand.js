// src/bot/backupCommand.js
// /backup — DB zaxirasini darhol olish (kundalik zaxira bilan bir xil format: bo'laklarga
// bo'lish, xato bo'lsa "❌" xabari — dbBackup.scheduler.js).
//
// Ruxsat: FAQAT DB_BACKUP_TELEGRAM_CHAT_ID chatidan. Boshqa joydan yozilsa oddiy
// "noma'lum buyruq" javobi qaytadi — zaxira funksiyasi borligi ham oshkor qilinmaydi
// (faylda butun baza: telefon raqamlar, to'lovlar).
// Cheklov: COOLDOWN_MS ichida 1 marta va bir vaqtda faqat bitta — har chaqiruv butun
// bazani o'qiydi.

const COOLDOWN_MS = 10 * 60 * 1000;
const UNKNOWN_COMMAND = "Noma'lum buyruq.";

/**
 * @param {{ bot, chatId: string|null, runBackup: () => Promise<void>, now?: () => number,
 *           cooldownMs?: number }} deps
 * @returns {(msg) => Promise<void>}
 */
const createBackupHandler = ({ bot, chatId, runBackup, now = Date.now, cooldownMs = COOLDOWN_MS }) => {
  let lastStartedAt = 0;
  let running = false;

  return async (msg) => {
    const fromChat = String(msg.chat.id);
    const who = `${msg.from?.id ?? '?'}${msg.from?.username ? ` (@${msg.from.username})` : ''}`;

    if (!chatId || fromChat !== String(chatId)) {
      console.warn(`⚠️ /backup ruxsatsiz urinish: chat ${fromChat}, user ${who}`);
      await bot.sendMessage(fromChat, UNKNOWN_COMMAND).catch(() => {});
      return;
    }

    if (running) {
      await bot.sendMessage(fromChat, '⏳ Zaxira hozir tayyorlanmoqda, biroz kuting.').catch(() => {});
      return;
    }

    const waitMs = lastStartedAt + cooldownMs - now();
    if (lastStartedAt && waitMs > 0) {
      const minutes = Math.ceil(waitMs / 60000);
      await bot
        .sendMessage(fromChat, `⏳ Keyingi zaxirani ${minutes} daqiqadan so'ng olish mumkin.`)
        .catch(() => {});
      return;
    }

    running = true;
    lastStartedAt = now();
    console.log(`🗄 /backup so'raldi: user ${who}`);

    try {
      await bot.sendMessage(fromChat, '⏳ Zaxira tayyorlanmoqda...').catch(() => {});
      // runBackup xatolarni o'zi ushlaydi va chatga "❌" xabarini yuboradi
      await runBackup();
    } finally {
      running = false;
    }
  };
};

// Botga ulash. Kundalik zaxira bilan bir xil chat va funksiya ishlatiladi.
const registerBackupCommand = (bot) => {
  const { TELEGRAM_CHAT_ID } = require('../config/backup');
  const { runBackupAndSend } = require('../jobs/dbBackup.scheduler');

  const handler = createBackupHandler({
    bot,
    chatId: TELEGRAM_CHAT_ID,
    runBackup: () => runBackupAndSend(),
  });

  // /backup yoki guruhda /backup@BotNomi
  bot.onText(/^\/backup(?:@\w+)?\s*$/, (msg) => {
    handler(msg).catch((error) => console.error('/backup xatosi:', error.message));
  });
};

module.exports = { createBackupHandler, registerBackupCommand, COOLDOWN_MS };
