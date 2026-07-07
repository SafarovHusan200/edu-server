// src/bot/telegramNotifier.js
// In-app bildirishnomalarni Telegram bot orqali ham yetkazish uchun ingichka qatlam.
// bot.js shu yerda LAZY require qilinadi — testlarda yoki token yo'q holatda
// haqiqiy Telegram API'ga umuman chiqilmasligi uchun.

const sendTelegramMessage = async (telegramId, text) => {
  if (!telegramId) return;

  // Testlarda haqiqiy tashqi tarmoqqa chiqmaslik uchun
  if (process.env.NODE_ENV === 'test') return;
  if (!process.env.TELEGRAM_BOT_TOKEN) return;

  try {
    const bot = require('./bot');
    await bot.sendMessage(telegramId, text, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('❌ Telegram bildirishnoma yuborilmadi:', error.message);
  }
};

module.exports = { sendTelegramMessage };
