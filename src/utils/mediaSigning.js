// src/utils/mediaSigning.js
// Dars video/material fayllari endi /uploads/lessons orqali ochiq berilmaydi (2026-10-31
// o'zgarishi). Buning o'rniga GET /lessons/:id, GET /courses/:id/lessons va
// GET /courses/:id kirish huquqi tekshirilgandan keyin videoUrl/attachments'ni shu yerdagi
// signLessonFileUrl orqali 15 daqiqalik imzolangan havolaga aylantiradi. Himoya token'da
// emas, imzoning o'zida (HMAC-SHA256) — media.controller.js shu imzoni tekshiradi.

const crypto = require('crypto');

// 2026-10-31: 15 daqiqadan 10 daqiqaga qisqartirildi — havolani qo'lda ulashish oynasini
// kamaytirish uchun (Referer tekshiruvi bilan birga, media.controller.js)
const EXPIRY_SECONDS = 10 * 60;
const LESSON_FILE_PREFIX = '/uploads/lessons/';

const getSecret = () => {
  const secret = process.env.MEDIA_SECRET;
  if (!secret) throw new Error('MEDIA_SECRET .env da o\'rnatilmagan');
  return secret;
};

const sign = (filename, exp, uid) =>
  crypto.createHmac('sha256', getSecret()).update(`${filename}:${exp}:${uid}`).digest('hex');

// filename/exp/uid/sig — query orqali kelgan xom (string) qiymatlar
const verifySignature = ({ filename, exp, uid, sig }) => {
  if (!filename || !exp || !uid || !sig) return false;
  if (!/^\d+$/.test(String(exp))) return false;
  if (Date.now() > Number(exp) * 1000) return false;

  const expected = sign(filename, exp, uid);
  const expectedBuf = Buffer.from(expected);
  const sigBuf = Buffer.from(String(sig));
  if (expectedBuf.length !== sigBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, sigBuf);
};

// DB'dagi xom yo'lni (masalan "/uploads/lessons/171234_55.mp4") 15 daqiqa amal qiladigan
// imzolangan media URL'ga aylantiradi. Tashqi havolalar (YouTube va h.k.) hamda
// lessons papkasiga tegishli bo'lmagan har qanday qiymat o'zgarishsiz qaytadi.
const signLessonFileUrl = (rawPath, userId) => {
  if (!rawPath || !rawPath.startsWith(LESSON_FILE_PREFIX)) return rawPath;

  const filename = rawPath.slice(LESSON_FILE_PREFIX.length);
  const uid = userId ? userId.toString() : 'anon';
  const exp = Math.floor(Date.now() / 1000) + EXPIRY_SECONDS;
  const sig = sign(filename, exp, uid);

  return `/api/v1/media/lessons/${encodeURIComponent(filename)}?exp=${exp}&uid=${uid}&sig=${sig}`;
};

// Ekrandan yozib olishni butunlay to'xtatolmaymiz, lekin video ustiga ko'rayotgan
// foydalanuvchini fosh qiluvchi matn chiqarish (frontendda overlay sifatida) sizib
// chiqqan videoni kim tarqatganini aniqlashga yordam beradi — caydiruvchi himoya
const buildWatermarkText = (user) => {
  if (!user || !user.name) return null;
  return `${user.name}${user.phone ? ' • ' + user.phone : ''}`;
};

// Bitta dars (plain object — lean/toObject) uchun videoUrl va attachments'dagi har bir
// yo'lni imzolangan havolaga aylantirib, yangi obyekt qaytaradi. watermarkText berilsa
// (ko'rayotgan foydalanuvchining ismi/telefoni), javobga `watermark` maydoni qo'shiladi —
// frontend buni video ustida shaffof overlay sifatida chiqaradi
const signLessonMedia = (lesson, userId, watermarkText) => {
  if (!lesson) return lesson;

  const signed = {
    ...lesson,
    videoUrl: signLessonFileUrl(lesson.videoUrl, userId),
    attachments: (lesson.attachments || []).map((filePath) => signLessonFileUrl(filePath, userId)),
  };

  if (watermarkText) {
    signed.watermark = watermarkText;
  }

  return signed;
};

module.exports = {
  EXPIRY_SECONDS,
  LESSON_FILE_PREFIX,
  verifySignature,
  signLessonFileUrl,
  signLessonMedia,
  buildWatermarkText,
};
