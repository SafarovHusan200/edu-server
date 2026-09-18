// src/config/backup.js

module.exports = {
  // Default: o'chirilgan — ataylab yoqilishi kerak (.env'da DB_BACKUP_ENABLED=true
  // va DB_BACKUP_TELEGRAM_CHAT_ID kiritilgach ishga tushadi)
  ENABLED: process.env.DB_BACKUP_ENABLED === 'true',

  // Cron ifodasi — default: har kuni soat 03:00 (Toshkent vaqti, server yuki kam paytda)
  CRON: process.env.DB_BACKUP_CRON || '0 3 * * *',

  // Zaxira fayli yuboriladigan Telegram chat ID (odatda superadminning shaxsiy
  // chat ID'si — @userinfobot orqali bilib olish mumkin). Ataylab BARCHA
  // adminlarga emas, faqat shu bitta (yoki guruh) ID'ga yuboriladi — nozik
  // ma'lumotni keraksiz ko'payishining oldini olish uchun.
  TELEGRAM_CHAT_ID: process.env.DB_BACKUP_TELEGRAM_CHAT_ID || null,
};
