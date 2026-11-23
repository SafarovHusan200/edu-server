// server.js

require('dotenv').config();

// 1. Env tekshirish — hech narsa (bot, DB, HTTP) ishga tushishidan OLDIN
const validateEnv = require('./src/config/env');
validateEnv();

const connectDB = require('./src/config/db');
const app = require('./src/app');
const { startBackupScheduler } = require('./src/jobs/dbBackup.scheduler');
const { startPaymentDraftScheduler } = require('./src/jobs/paymentDraft.scheduler');
const { initSocket } = require('./src/socket');

const PORT = process.env.PORT || 5000;
let server = null;

// To'xtash: yangi ulanishlar qabul qilinmaydi, joriy so'rovlar tugashi kutiladi
// (osilib qolsa — 10 soniyadan keyin majburan). PM2 shundan keyin qayta ishga tushiradi.
const shutdown = (code) => {
  if (!server) process.exit(code);
  server.close(() => process.exit(code));
  setTimeout(() => process.exit(code), 10 * 1000).unref();
};

// 4. Kutilmagan xatolar
// unhandledRejection — biror joyda .catch() unutilgan promise. Jarayon holati buzilmagan,
// shuning uchun server O'CHIRILMAYDI (aks holda bitta xato barcha foydalanuvchilarni va
// xotiradagi jonli o'yinlarni uzib qo'yardi) — faqat to'liq stack bilan loglanadi.
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason instanceof Error ? reason.stack : reason);
});

// uncaughtException — sinxron xato hech qayerda ushlanmagan: jarayon holati noma'lum,
// ishlashda davom etish xavfli (Node.js tavsiyasi). Joriy so'rovlar tugatilib, chiqiladi.
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.stack || err);
  shutdown(1);
});

process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));

const start = async () => {
  // 2. DB ulanish — ulanmaguncha so'rov qabul qilinmaydi (ulanmasa connectDB jarayonni to'xtatadi)
  await connectDB();

  // Telegram bot (polling) — DB tayyor bo'lgach: bot handlerlari darhol User/Otp'ga murojaat qiladi
  require('./src/bot/bot');

  // 2.1 Kunlik DB zaxira jadvali (DB_BACKUP_ENABLED=true bo'lsagina ishga tushadi)
  startBackupScheduler();

  // 2.2 Eski draft to'lovlarni Multicard'da tekshirib, to'lanmaganlarini 'expired' qilish
  startPaymentDraftScheduler();

  // 3. HTTP server
  server = app.listen(PORT, () => {
    console.log(`🚀 Server ishga tushdi: http://localhost:${PORT}`);
    console.log(`📦 Muhit: ${process.env.NODE_ENV}`);
  });

  // 3.1 Real-time (Socket.IO) — jonli viktorina uchun
  initSocket(server);
};

start();

// Husan Safarov
