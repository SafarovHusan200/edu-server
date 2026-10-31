// src/utils/mediaSigning.js
// Dars video/material fayllari endi /uploads/lessons orqali ochiq berilmaydi (2026-10-31
// o'zgarishi). Buning o'rniga GET /lessons/:id, GET /courses/:id/lessons va
// GET /courses/:id kirish huquqi tekshirilgandan keyin videoUrl/attachments'ni shu yerdagi
// signLessonFileUrl orqali 15 daqiqalik imzolangan havolaga aylantiradi. Himoya token'da
// emas, imzoning o'zida (HMAC-SHA256) — media.controller.js shu imzoni tekshiradi.

const crypto = require('crypto');

const EXPIRY_SECONDS = 15 * 60;
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

// Bitta dars (plain object — lean/toObject) uchun videoUrl va attachments'dagi har bir
// yo'lni imzolangan havolaga aylantirib, yangi obyekt qaytaradi
const signLessonMedia = (lesson, userId) => {
  if (!lesson) return lesson;

  return {
    ...lesson,
    videoUrl: signLessonFileUrl(lesson.videoUrl, userId),
    attachments: (lesson.attachments || []).map((filePath) => signLessonFileUrl(filePath, userId)),
  };
};

module.exports = {
  EXPIRY_SECONDS,
  LESSON_FILE_PREFIX,
  verifySignature,
  signLessonFileUrl,
  signLessonMedia,
};
