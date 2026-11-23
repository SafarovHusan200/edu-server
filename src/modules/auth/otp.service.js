// src/modules/auth/otp.service.js
// Telegram bot orqali kirish kodlari. Har bir so'rovda ikkita sir beriladi:
//  - code      — 6 xonali raqam, foydalanuvchi saytga QO'LDA kiritadi;
//  - linkToken — uzun tasodifiy token, faqat "Saytda kirish" havolasida (tg_code=...) ketadi.
// Ikkalasi ham POST /auth/telegram'ga `code` maydonida yuboriladi; formatiga qarab qaysi
// biri ekani aniqlanadi. Havola 6 xonali kod bilan emas, token bilan ishlagani uchun
// taxmin qilinadigan yagona sir — 3 daqiqa yashaydigan 6 xonali kod; uni ketma-ket
// sinab ko'rish otpLimiter (rateLimiter.js) bilan cheklangan.

const crypto = require('crypto');
const Otp = require('./otp.model');

const OTP_TTL_MS = 3 * 60 * 1000; // 3 daqiqa

const CODE_PATTERN = /^\d{6}$/;
// randomBytes(24) → base64url'da aynan 32 belgi
const LINK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

// Faol kodlar orasida takrorlanmaydigan 6 xonali kod. Math.random emas — crypto.randomInt
// (oldindan taxmin qilib bo'lmaydi)
const generateUniqueCode = async () => {
  for (let i = 0; i < 10; i += 1) {
    const code = String(crypto.randomInt(100000, 1000000));
    const taken = await Otp.exists({ code, isUsed: false, expiresAt: { $gt: new Date() } });
    if (!taken) return code;
  }
  throw new Error("Bo'sh OTP kodi topilmadi");
};

// Eski kodlarni bekor qilib, yangisini yaratadi — /login va "Kodni yangilash" ikkalasi ham shundan foydalanadi
const issueLoginOtp = async (telegramId) => {
  const code = await generateUniqueCode();
  const linkToken = crypto.randomBytes(24).toString('base64url');

  await Otp.deleteMany({ telegramId });
  await Otp.create({
    telegramId,
    code,
    linkToken,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  return { code, linkToken };
};

// Kodni ATOMIK "ishlatilgan" qiladi — bir xil kod bilan parallel ikki so'rov kelsa,
// faqat bittasi muvaffaqiyatli bo'ladi. Topilmasa (noto'g'ri/eskirgan/ishlatilgan) — null
const consumeLoginOtp = async (secret) => {
  let match;
  if (CODE_PATTERN.test(secret)) match = { code: secret };
  else if (LINK_TOKEN_PATTERN.test(secret)) match = { linkToken: secret };
  else return null;

  return Otp.findOneAndUpdate(
    { ...match, isUsed: false, expiresAt: { $gt: new Date() } },
    { isUsed: true },
    { new: true }
  );
};

module.exports = { issueLoginOtp, consumeLoginOtp, CODE_PATTERN, LINK_TOKEN_PATTERN, OTP_TTL_MS };
