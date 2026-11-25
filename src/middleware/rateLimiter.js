// src/middleware/rateLimiter.js

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { verifySignature, verifyHlsSignature } = require('../utils/mediaSigning');

const { ipKeyGenerator } = rateLimit;

// Test muhitida limitlash o'chirilgan — aks holda testlar bir xil IP'dan
// ko'plab so'rov yuborgani uchun beqaror (flaky) bo'lib qoladi.
const skip = () => process.env.NODE_ENV === 'test';

// Test muhitida o'chiq, lekin limitning o'zini sinash uchun env bayroq bilan yoqiladi
const skipInTestUnless = (flag) => () => process.env.NODE_ENV === 'test' && process.env[flag] !== 'true';

const tooManyAttempts = (message) => ({ success: false, statusCode: 429, message });

// ─────────────── Login qilgan foydalanuvchi va ichki (SSR) so'rovlar ───────────────

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

// Frontend (Next.js) SSR so'rovlari tokensiz va hammasi bitta server IP'sidan keladi —
// ular `X-Internal-Key: <SSR_INTERNAL_KEY>` sarlavhasi bilan anonim limitdan ozod.
// SSR_INTERNAL_KEY bo'sh bo'lsa imtiyoz o'chiq. Kalit hech qayerda logga yozilmaydi.
const hasInternalKey = (req) => {
  const expected = process.env.SSR_INTERNAL_KEY;
  const given = req.headers['x-internal-key'];
  if (!expected || typeof given !== 'string' || !given) return false;

  const expectedBuf = Buffer.from(expected);
  const givenBuf = Buffer.from(given);
  if (expectedBuf.length !== givenBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, givenBuf);
};

const isTrustedRequest = (req) => isLoggedIn(req) || hasInternalKey(req);

const skipForTestOrLoggedIn = (req) => skip() || isTrustedRequest(req);

// ─────────────── Login / register / Telegram ───────────────

// Maktabda butun sinf bitta IP (NAT) orqali chiqadi. Shuning uchun:
//  - authLimiter: IP + login (telefon) bo'yicha — bir o'quvchi parolni adashtirsa, faqat
//    o'sha akkaunt bloklanadi, sinfdoshlari kiraveradi (parol taxminlashga qarshi himoya);
//  - authIpLimiter: IP bo'yicha umumiy, kattaroq to'r (ko'p akkauntni aylanib urinishga qarshi).
// Ikkalasida ham faqat MUVAFFAQIYATSIZ urinishlar (status >= 400) sanaladi.
// Test muhitida o'chiq; limitning o'zini sinash uchun AUTH_LIMITER_ENABLED=true.

// Telefon: faqat raqamlar ("+998 90 123-45-67" va "998901234567" bitta akkaunt)
const normalizeLoginId = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const raw = String(value).trim().toLowerCase().slice(0, 64);
  const digits = raw.replace(/\D/g, '');
  return digits || raw;
};

// /auth/telegram (kod) va /auth/telegram-webapp (imzosi hali tekshirilmagan initData) da
// ishonchli login identifikatori yo'q — kalit faqat IP
const authKey = (req) => {
  const ip = ipKeyGenerator(req.ip);
  const loginId = normalizeLoginId(req.body?.phone);
  return loginId ? `auth:${ip}:${loginId}` : `auth:${ip}`;
};

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 daqiqa
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: skipInTestUnless('AUTH_LIMITER_ENABLED'),
  keyGenerator: authKey,
  message: tooManyAttempts("Juda ko'p urinish qildingiz. 5 daqiqadan so'ng qayta urinib ko'ring"),
});

const authIpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: skipInTestUnless('AUTH_LIMITER_ENABLED'),
  keyGenerator: (req) => `auth-ip:${ipKeyGenerator(req.ip)}`,
  message: tooManyAttempts("Bu tarmoqdan juda ko'p muvaffaqiyatsiz urinish bo'ldi. 5 daqiqadan so'ng qayta urinib ko'ring"),
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
  skip: skipInTestUnless('OTP_LIMITER_ENABLED'),
  keyGenerator: (req) => `otp:${ipKeyGenerator(req.ip)}`,
  message: tooManyAttempts("Kod juda ko'p marta noto'g'ri kiritildi. 15 daqiqadan so'ng qayta urinib ko'ring"),
});

// ─────────────── Umumiy /api/v1 ───────────────

// Barcha /api/v1 uchun umumiy xavfsizlik to'ri — faqat anonim so'rovlar uchun
// (login qilgan foydalanuvchi va X-Internal-Key bilan kelgan SSR so'rovlari chegarasiz).
// Test muhitida o'chiq; limitning o'zini sinash uchun API_LIMITER_ENABLED=true.
const skipInTestApi = skipInTestUnless('API_LIMITER_ENABLED');
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => skipInTestApi() || isTrustedRequest(req),
  message: tooManyAttempts("Juda ko'p so'rov yubordingiz. Birozdan so'ng qayta urinib ko'ring"),
});

module.exports = {
  authLimiter,
  authIpLimiter,
  otpLimiter,
  apiLimiter,
  isLoggedIn,
  hasInternalKey,
  skipForTestOrLoggedIn,
};
