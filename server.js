// server.js

require('dotenv').config();
require('./src/bot/bot');

const validateEnv = require('./src/config/env');
const connectDB = require('./src/config/db');
const app = require('./src/app');

// 1. Env tekshirish
validateEnv();

// 2. DB ulanish
connectDB();

// 3. Serverni ishga tushirish
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server ishga tushdi: http://localhost:${PORT}`);
  console.log(`📦 Muhit: ${process.env.NODE_ENV}`);
});

// 4. Kutilmagan xatolarni ushlash
process.on('unhandledRejection', (err) => {
  console.error(`❌ Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  console.error(`❌ Uncaught Exception: ${err.message}`);
  process.exit(1);
});
