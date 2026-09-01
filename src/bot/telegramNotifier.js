// src/bot/telegramNotifier.js
// In-app bildirishnomalarni Telegram bot orqali ham yetkazish uchun ingichka qatlam.
// bot.js shu yerda LAZY require qilinadi — testlarda yoki token yo'q holatda
// haqiqiy Telegram API'ga umuman chiqilmasligi uchun.

// options.url berilsa — xabar ostiga "ochish" tugmasi (inline keyboard) qo'shiladi,
// shunda foydalanuvchi tegishli sahifani bir bosishda ocha oladi
const sendTelegramMessage = async (telegramId, text, options) => {
  if (!telegramId) return;

  // Testlarda haqiqiy tashqi tarmoqqa chiqmaslik uchun
  if (process.env.NODE_ENV === 'test') return;
  if (!process.env.TELEGRAM_BOT_TOKEN) return;

  try {
    const bot = require('./bot');
    const sendOptions = { parse_mode: 'HTML' };

    if (options?.url) {
      sendOptions.reply_markup = {
        inline_keyboard: [[{ text: options.buttonText || '🔗 Ochish', url: options.url }]],
      };
    }

    await bot.sendMessage(telegramId, text, sendOptions);
  } catch (error) {
    console.error('❌ Telegram bildirishnoma yuborilmadi:', error.message);
  }
};

module.exports = { sendTelegramMessage };
