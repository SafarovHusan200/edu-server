// src/middleware/rateLimiter.js

const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { verifySignature, verifyHlsSignature } = require('../utils/mediaSigning');

// Test muhitida limitlash o'chirilgan — aks holda testlar bir xil IP'dan
// ko'plab so'rov yuborgani uchun beqaror (flaky) bo'lib qoladi.
const skip = () => process.env.NODE_ENV === 'test';

// Imzolangan media havolalari (video/HLS/material) — player Bearer token yubormaydi,
// lekin havola faqat login qilgan foydalanuvchi uchun (uid != 'anon') imzolangan bo'lsa
// u ham "login qilgan" deb hisoblanadi.
const MEDIA_LESSON_RE = /^\/api\/v1\/media\/lessons\/([^/]+)$/;
const MEDIA_HLS_RE = /^\/api\/v1\/media\/hls\/([^/]+)\/(.+)$/;

const hasSignedUserMediaLink = (req) => {
  const { exp, uid, sig } = req.query || {};
  if (!uid || uid === 'anon') return false;

  const pathname = (req.originalUrl || '').split('?')[0];
  try {
    const lessonMatch = pathname.match(MEDIA_LESSON_RE);
    if (lessonMatch) {
      return verifySignature({ filename: decodeURIComponent(lessonMatch[1]), exp, uid, sig });
    }
    const hlsMatch = pathname.match(MEDIA_HLS_RE);
    if (hlsMatch) {
      return verifyHlsSignature({ lessonId: hlsMatch[1], resourcePath: hlsMatch[2], exp, uid, sig });
    }
  } catch {
    return false;
  }
  return false;
};

// Login qilgan foydalanuvchi uchun limit yo'q. Bu yerda faqat imzo tekshiriladi (DB'ga
// murojaatsiz) — bloklangan/tokenVersion eskirgan holatlarni baribir authenticate rad etadi.
const isLoggedIn = (req) => {
  if (req.user) return true;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      jwt.verify(authHeader.split(' ')[1], process.env.JWT_TOKEN_SECRET);
      return true;
    } catch {
      // yaroqsiz token — oddiy (anonim) so'rov sifatida limitlanadi
    }
  }

  return hasSignedUserMediaLink(req);
};

const skipForTestOrLoggedIn = (req) => skip() || isLoggedIn(req);

// Login/register/telegram-otp kabi og'ir suiiste'mol qilinadigan endpointlar uchun.
// Faqat MUVAFFAQIYATSIZ urinishlar (status >= 400) sanaladi: maktabda butun sinf bitta
// IP (NAT) orqali chiqadi, to'g'ri kirgan o'quvchilar limitni yeb qo'ymasligi kerak.
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 daqiqa
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip,
  message: {
    success: false,
    statusCode: 429,
    message: "Juda ko'p urinish qildingiz. 5 daqiqadan so'ng qayta urinib ko'ring",
  },
});

// POST /auth/telegram — 6 xonali kodni ketma-ket taxmin qilishga qarshi. Faqat MUVAFFAQIYATSIZ
// urinishlar sanaladi (to'g'ri kod bilan kirgan oddiy foydalanuvchiga ta'sir qilmaydi).
// Test muhitida o'chiq; limitning o'zini sinash uchun OTP_LIMITER_ENABLED=true.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: () => process.env.NODE_ENV === 'test' && process.env.OTP_LIMITER_ENABLED !== 'true',
  keyGenerator: (req) => `otp:${rateLimit.ipKeyGenerator(req.ip)}`,
  message: {
    success: false,
    statusCode: 429,
    message: "Kod juda ko'p marta noto'g'ri kiritildi. 15 daqiqadan so'ng qayta urinib ko'ring",
  },
});

// Barcha /api/v1 uchun umumiy xavfsizlik to'ri — faqat anonim so'rovlar uchun
// (login qilgan foydalanuvchi chegarasiz)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipForTestOrLoggedIn,
  message: {
    success: false,
    statusCode: 429,
    message: "Juda ko'p so'rov yubordingiz. Birozdan so'ng qayta urinib ko'ring",
  },
});

module.exports = { authLimiter, otpLimiter, apiLimiter, isLoggedIn, skipForTestOrLoggedIn };
