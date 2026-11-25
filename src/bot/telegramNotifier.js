// src/bot/telegramNotifier.js
// In-app bildirishnomalarni Telegram bot orqali ham yetkazish uchun ingichka qatlam.
// bot.js shu yerda LAZY require qilinadi — testlarda yoki token yo'q holatda
// haqiqiy Telegram API'ga umuman chiqilmasligi uchun.

// options.url berilsa — xabar ostiga "ochish" (URL) tugmasi qo'shiladi.
// options.callbackData berilsa — botning o'zida amal boshlaydigan tugma qo'shiladi
// (masalan "Botda tekshirish" — bot.js'dagi callback_query handler shu data'ni ushlaydi).
// Ikkalasi ham berilsa, ikkala tugma ham chiqadi.
const sendTelegramMessage = async (telegramId, text, options) => {
  if (!telegramId) return;

  // Testlarda haqiqiy tashqi tarmoqqa chiqmaslik uchun
  if (process.env.NODE_ENV === 'test') return;
  if (!process.env.TELEGRAM_BOT_TOKEN) return;

  try {
    const bot = require('./bot');
    const sendOptions = { parse_mode: 'HTML' };

    const buttons = [];
    if (options?.url) {
      buttons.push([{ text: options.buttonText || '🔗 Ochish', url: options.url }]);
    }
    if (options?.callbackData) {
      buttons.push([
        { text: options.callbackButtonText || '🤖 Bu yerda bajarish', callback_data: options.callbackData },
      ]);
    }
    if (buttons.length) {
      sendOptions.reply_markup = { inline_keyboard: buttons };
    }

    await bot.sendMessage(telegramId, text, sendOptions);
  } catch (error) {
    console.error('❌ Telegram bildirishnoma yuborilmadi:', error.message);
  }
};

// Foydalanuvchi chatidagi menyu tugmasini (pastki chap «📱 Ilova») uning roliga
// moslaydi: tasdiqlangan o'qituvchi/admin — Mini App, qolganlar — standart menyu.
// Rol/tasdiq/blok holati o'zgarganda chaqiriladi; xatolar asosiy amalni to'xtatmaydi.
const syncMiniAppMenu = async (user) => {
  if (!user?.telegramId) return;
  if (process.env.NODE_ENV === 'test') return;
  if (!process.env.TELEGRAM_BOT_TOKEN) return;

  try {
    const { buildMenuButton } = require('./miniApp');
    const bot = require('./bot');
    await bot.setChatMenuButton({
      chat_id: user.telegramId,
      menu_button: JSON.stringify(buildMenuButton(user)),
    });
  } catch (error) {
    console.error('❌ Mini App menyu tugmasi o\'rnatilmadi:', error.message);
  }
};

module.exports = { sendTelegramMessage, syncMiniAppMenu };
