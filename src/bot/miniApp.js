// src/bot/miniApp.js
// Telegram Mini App (o'qituvchi va adminlar uchun) — frontenddagi /tg sahifasi.
// Bu fayl bot obyektiga bog'liq emas (sof funksiyalar) — testlarda to'g'ridan-to'g'ri
// chaqirish mumkin. Botga yuborish telegramNotifier.syncMiniAppMenu orqali.

const { FRONTEND_URL } = require('../config/frontendLinks');

// Telegram web_app tugmalari faqat HTTPS manzilni qabul qiladi
const MINI_APP_URL = `${FRONTEND_URL.replace(/\/+$/, '')}/tg`;

const MINI_APP_ROLES = ['teacher', 'admin', 'superadmin'];

const MINI_APP_BUTTON_TEXT = '📱 Ilova';

// Mini App'ni faqat tasdiqlangan, bloklanmagan o'qituvchi/admin ochadi
// (o'quvchilar uchun hozircha yo'q — ular saytdan foydalanadi)
const canUseMiniApp = (user) =>
  !!user && MINI_APP_ROLES.includes(user.role) && !!user.isVerified && !user.isBlocked;

const isHttps = (url) => /^https:\/\//i.test(url);

// Chat menyusidagi tugma: ruxsat bo'lsa — Mini App, aks holda standart (/buyruqlar) menyu.
// Rol o'zgarsa yoki bloklansa — eski tugma "default"ga qaytariladi.
const buildMenuButton = (user, url = MINI_APP_URL) =>
  canUseMiniApp(user) && isHttps(url)
    ? { type: 'web_app', text: MINI_APP_BUTTON_TEXT, web_app: { url } }
    : { type: 'default' };

// Xabar ostidagi "Ilovani ochish" tugmasi (path — /tg ichidagi bo'lim, masalan "/teacher/grading")
const buildOpenButton = (path = '', text = '📱 Ilovani ochish', url = MINI_APP_URL) => ({
  text,
  web_app: { url: `${url}${path}` },
});

module.exports = {
  MINI_APP_URL,
  MINI_APP_ROLES,
  canUseMiniApp,
  buildMenuButton,
  buildOpenButton,
  isHttps,
};
