// src/utils/mediaSigning.js
// Dars video/material fayllari endi /uploads/lessons orqali ochiq berilmaydi (2026-10-31
// o'zgarishi). Buning o'rniga GET /lessons/:id, GET /courses/:id/lessons va
// GET /courses/:id kirish huquqi tekshirilgandan keyin videoUrl/attachments'ni shu yerdagi
// signLessonFileUrl orqali 10 daqiqa amal qiladigan imzolangan havolaga aylantiradi. Himoya
// token'da emas, imzoning o'zida (HMAC-SHA256) — media.controller.js/hls.controller.js shu
// imzoni tekshiradi. 2026-11-02: o'zimiz yuklagan mp4'lar HLS+AES-128'ga o'tkazilgandan
// keyin (Lesson.videoStatus="ready") videoUrl o'rniga signHlsResource bilan imzolangan
// master.m3u8 havolasi qaytariladi (src/utils/hlsConverter.js).

const crypto = require('crypto');
const { FRONTEND_URL } = require('../config/frontendLinks');

// 2026-10-31: 15 daqiqadan 10 daqiqaga qisqartirildi — havolani qo'lda ulashish oynasini
// kamaytirish uchun (manba tekshiruvi bilan birga, quyida)
const EXPIRY_SECONDS = 10 * 60;
const LESSON_FILE_PREFIX = '/uploads/lessons/';

const getSecret = () => {
  const secret = process.env.MEDIA_SECRET;
  if (!secret) throw new Error('MEDIA_SECRET .env da o\'rnatilmagan');
  return secret;
};

// subject — imzolanadigan "narsa"ning o'ziga xos matni (fayl nomi, yoki HLS uchun
// "<lessonId>:<resourcePath>"). Bir xil formula barcha media turlari uchun ishlatiladi.
const sign = (subject, exp, uid) =>
  crypto.createHmac('sha256', getSecret()).update(`${subject}:${exp}:${uid}`).digest('hex');

const timingSafeEqualStrings = (a, b) => {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

const isExpired = (exp) => {
  if (!/^\d+$/.test(String(exp))) return true;
  return Date.now() > Number(exp) * 1000;
};

// filename/exp/uid/sig — query orqali kelgan xom (string) qiymatlar
const verifySignature = ({ filename, exp, uid, sig }) => {
  if (!filename || !exp || !uid || !sig) return false;
  if (isExpired(exp)) return false;
  return timingSafeEqualStrings(sign(filename, exp, uid), String(sig));
};

// HLS resurslari (master/variant playlist, segment) uchun — subject = "<lessonId>:<resourcePath>"
const verifyHlsSignature = ({ lessonId, resourcePath, exp, uid, sig }) => {
  if (!lessonId || !resourcePath || !exp || !uid || !sig) return false;
  if (isExpired(exp)) return false;
  return timingSafeEqualStrings(sign(`${lessonId}:${resourcePath}`, exp, uid), String(sig));
};

// DB'dagi xom yo'lni (masalan "/uploads/lessons/171234_55.mp4") imzolangan media URL'ga
// aylantiradi. Tashqi havolalar (YouTube va h.k.) hamda lessons papkasiga tegishli
// bo'lmagan har qanday qiymat o'zgarishsiz qaytadi.
const signLessonFileUrl = (rawPath, userId) => {
  if (!rawPath || !rawPath.startsWith(LESSON_FILE_PREFIX)) return rawPath;

  const filename = rawPath.slice(LESSON_FILE_PREFIX.length);
  const uid = userId ? userId.toString() : 'anon';
  const exp = Math.floor(Date.now() / 1000) + EXPIRY_SECONDS;
  const sig = sign(filename, exp, uid);

  return `/api/v1/media/lessons/${encodeURIComponent(filename)}?exp=${exp}&uid=${uid}&sig=${sig}`;
};

// HLS master/variant playlist yoki segment uchun imzolangan havola quradi.
// resourcePath masalan: "master.m3u8", "480p/playlist.m3u8", "480p/seg/0.ts"
const signHlsResource = (lessonId, resourcePath, userId) => {
  const uid = userId ? userId.toString() : 'anon';
  const exp = Math.floor(Date.now() / 1000) + EXPIRY_SECONDS;
  const sig = sign(`${lessonId}:${resourcePath}`, exp, uid);

  return `/api/v1/media/hls/${lessonId}/${resourcePath}?exp=${exp}&uid=${uid}&sig=${sig}`;
};

// Boshqa saytga "hotlink" qilinishining oldini olish uchun: Referer/Origin BERILGAN
// bo'lsa, ruxsat etilgan ro'yxatda bo'lishi kerak (.env'dagi MEDIA_ALLOWED_ORIGINS, vergul
// bilan ajratilgan, bo'lmasa FRONTEND_URL). Lekin bu header ko'p holatlarda umuman
// kelmaydi (Safari/Brave maxfiylik rejimi, Telegram Mini App webview, mobil ilovalar) —
// bunda rad ETILMAYDI, chunki asosiy himoya imzoning o'zida (exp/uid/sig)
const getAllowedOrigins = () =>
  new Set(
    (process.env.MEDIA_ALLOWED_ORIGINS || FRONTEND_URL)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  );

const isAllowedMediaOrigin = (req) => {
  const source = req.headers.referer || req.headers.origin;
  if (!source) return true;

  try {
    return getAllowedOrigins().has(new URL(source).origin);
  } catch {
    return false;
  }
};

// Ekrandan yozib olishni butunlay to'xtatolmaymiz, lekin video ustiga ko'rayotgan
// foydalanuvchini fosh qiluvchi matn chiqarish (frontendda overlay sifatida) sizib
// chiqqan videoni kim tarqatganini aniqlashga yordam beradi — caydiruvchi himoya.
// 2026-11-02: telefon raqam olib tashlandi (frontend ism+foydalanuvchi ID'sini birga
// ko'rsatadi) — faqat ism qaytariladi.
const buildWatermarkText = (user) => {
  if (!user || !user.name) return null;
  return user.name;
};

// Bitta dars (plain object — lean/toObject) uchun video/attachments maydonlarini
// imzolangan havolaga aylantirib, yangi obyekt qaytaradi. watermarkText berilsa, javobga
// `watermark` maydoni qo'shiladi.
//
// Video holati (lesson.videoStatus) bo'yicha:
//   - "ready"  -> videoUrl o'rniga { type:"hls", url:"<imzolangan master.m3u8>" }
//   - boshqa holatlar (none/processing/failed) -> eski mp4 (yoki tashqi havola)
//     o'zgarishsiz videoUrl sifatida qaytadi (konvertatsiya tugaguncha vaqtincha)
const signLessonMedia = (lesson, userId, watermarkText) => {
  if (!lesson) return lesson;

  const videoStatus = lesson.videoStatus || 'none';

  const signed = {
    ...lesson,
    videoStatus,
    attachments: (lesson.attachments || []).map((filePath) => signLessonFileUrl(filePath, userId)),
  };

  if (videoStatus === 'ready') {
    delete signed.videoUrl;
    signed.video = { type: 'hls', url: signHlsResource(lesson._id, 'master.m3u8', userId) };
  } else {
    signed.videoUrl = signLessonFileUrl(lesson.videoUrl, userId);
  }

  if (watermarkText) {
    signed.watermark = watermarkText;
  }

  return signed;
};

module.exports = {
  EXPIRY_SECONDS,
  LESSON_FILE_PREFIX,
  verifySignature,
  verifyHlsSignature,
  signLessonFileUrl,
  signHlsResource,
  signLessonMedia,
  buildWatermarkText,
  isAllowedMediaOrigin,
};
