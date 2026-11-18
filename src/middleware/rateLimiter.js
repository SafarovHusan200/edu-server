// src/middleware/rateLimiter.js

const rateLimit = require('express-rate-limit');

// Test muhitida limitlash o'chirilgan — aks holda testlar bir xil IP'dan
// ko'plab so'rov yuborgani uchun beqaror (flaky) bo'lib qoladi.
const skip = () => process.env.NODE_ENV === 'test';

// Login/register/telegram-otp kabi og'ir suiiste'mol qilinadigan endpointlar uchun
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 15 daqiqa
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: {
    success: false,
    statusCode: 429,
    message: "Juda ko'p urinish qildingiz. 5 daqiqadan so'ng qayta urinib ko'ring",
  },
});

// Barcha /api/v1 uchun umumiy xavfsizlik to'ri
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: {
    success: false,
    statusCode: 429,
    message: "Juda ko'p so'rov yubordingiz. Birozdan so'ng qayta urinib ko'ring",
  },
});

// AI generatsiya (POST /board-lessons/generate) — Gemini bepul tarif limitini himoya qilish uchun.
// authenticate'dan KEYIN qo'llanadi: kalit — foydalanuvchi ID'si (bir maktab = bitta IP bo'lishi mumkin).
// Test muhitida boshqa limiterlar kabi o'chiq; limitning o'zini sinash uchun AI_LIMITER_ENABLED=true.
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test' && process.env.AI_LIMITER_ENABLED !== 'true',
  keyGenerator: (req) => `ai:${req.user.id}`,
  message: {
    success: false,
    statusCode: 429,
    message: "Juda ko'p so'rov. Bir oz kuting",
  },
});

module.exports = { authLimiter, apiLimiter, aiLimiter };
