// src/modules/media/media.routes.js

const express = require('express');
const router = express.Router();
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const mediaController = require('./media.controller');
const hlsController = require('./hls.controller');
const authenticate = require('../../middleware/authenticate');

// Bitta uid (yoki anonim bo'lsa IP) uchun daqiqasiga 120 so'rov — video bir nechta
// Range so'rovi yuborishi (segmentlab yuklash) normal, shuning uchun limit yuqori
const mediaLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: (req) => req.query.uid || ipKeyGenerator(req.ip),
  message: {
    success: false,
    statusCode: 429,
    message: "Juda ko'p so'rov yubordingiz. Birozdan so'ng qayta urinib ko'ring",
  },
});

/**
 * @swagger
 * /media/lessons/{filename}:
 *   get:
 *     summary: Himoyalangan dars video/material faylini imzolangan havola orqali olish
 *     tags: [Media]
 *     security: []
 *     description: >
 *       Token talab qilinmaydi — himoya `sig` imzosining o'zida. `exp`, `uid`, `sig`
 *       GET /lessons/{id} yoki GET /courses/{id}/lessons javobidagi `videoUrl`/`attachments`
 *       ichida tayyor keladi; frontend bu havolani o'zgartirmasdan ishlatadi. Havola 10
 *       daqiqadan keyin eskiradi (403). Agar so'rovda `Referer`/`Origin` header BERILGAN
 *       bo'lsa (ko'p brauzerlar video/link so'rovida yuboradi), u `MEDIA_ALLOWED_ORIGINS`
 *       ro'yxatida bo'lishi kerak — bo'lmasa (boshqa saytga hotlink) 403. Header umuman
 *       kelmasa (Safari/Brave maxfiylik rejimi, Telegram Mini App) rad etilmaydi — himoya
 *       shu holatda ham imzoning o'zida qoladi. Video oldinga surish uchun Range so'rovlari
 *       (206 Partial Content) qo'llab-quvvatlanadi.
 *     parameters:
 *       - { name: filename, in: path, required: true, schema: { type: string } }
 *       - { name: exp, in: query, required: true, schema: { type: integer }, description: 'Unix vaqt (soniyada), havola shu vaqtgacha amal qiladi' }
 *       - { name: uid, in: query, required: true, schema: { type: string } }
 *       - { name: sig, in: query, required: true, schema: { type: string }, description: 'HMAC-SHA256(MEDIA_SECRET, `${filename}:${exp}:${uid}`)' }
 *     responses:
 *       200: { description: "Fayl (Range so'ralmagan bo'lsa)" }
 *       206: { description: "Faylning so'ralgan qismi (Range bilan)" }
 *       403: { description: "Imzo noto'g'ri yoki havola muddati o'tgan" }
 *       404: { description: 'Fayl topilmadi' }
 *       429: { description: "Juda ko'p so'rov (daqiqasiga 120 so'rovdan ko'p)" }
 */
router.get('/lessons/:filename', mediaLimiter, mediaController.getLessonFile);

// HLS (AES-128 shifrlangan) dars videosi — playlist/segment uchun mediaLimiter (120/daq),
// kalit uchun alohida, qattiqroq limit (30/daq, uid=req.user.id orqali)
const keyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip),
  message: {
    success: false,
    statusCode: 429,
    message: "Juda ko'p so'rov yubordingiz. Birozdan so'ng qayta urinib ko'ring",
  },
});

/**
 * @swagger
 * /media/hls/{lessonId}/master.m3u8:
 *   get:
 *     summary: HLS (AES-128 shifrlangan) dars videosining master playlist'i
 *     tags: [Media]
 *     security: []
 *     description: >
 *       lesson.video.url (GET /lessons/{id}) ichida tayyor keladi, o'zgartirmasdan
 *       `<video>` pleyerga (hls.js yoki shunga o'xshash) beriladi. Ichidagi variant
 *       playlist havolalari so'rov yuborgan foydalanuvchiga xos qayta imzolanadi.
 *     parameters:
 *       - { name: lessonId, in: path, required: true, schema: { type: string } }
 *       - { name: exp, in: query, required: true, schema: { type: integer } }
 *       - { name: uid, in: query, required: true, schema: { type: string } }
 *       - { name: sig, in: query, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: 'master.m3u8 matni' }
 *       403: { description: "Imzo noto'g'ri yoki muddati o'tgan" }
 *       404: { description: 'Topilmadi (hali konvertatsiya qilinmagan)' }
 */
router.get('/hls/:lessonId/master.m3u8', mediaLimiter, hlsController.getMasterPlaylist);

/**
 * @swagger
 * /media/hls/{lessonId}/{variant}/playlist.m3u8:
 *   get:
 *     summary: HLS variant (480p/720p) playlist'i
 *     tags: [Media]
 *     security: []
 *     parameters:
 *       - { name: lessonId, in: path, required: true, schema: { type: string } }
 *       - { name: variant, in: path, required: true, schema: { type: string, enum: [480p, 720p] } }
 *       - { name: exp, in: query, required: true, schema: { type: integer } }
 *       - { name: uid, in: query, required: true, schema: { type: string } }
 *       - { name: sig, in: query, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: 'variant playlist matni' }
 *       403: { description: "Imzo noto'g'ri yoki muddati o'tgan" }
 *       404: { description: 'Topilmadi' }
 */
router.get('/hls/:lessonId/:variant/playlist.m3u8', mediaLimiter, hlsController.getVariantPlaylist);

/**
 * @swagger
 * /media/hls/{lessonId}/{variant}/seg/{filename}:
 *   get:
 *     summary: HLS video bo'lagi (shifrlangan .ts)
 *     tags: [Media]
 *     security: []
 *     parameters:
 *       - { name: lessonId, in: path, required: true, schema: { type: string } }
 *       - { name: variant, in: path, required: true, schema: { type: string, enum: [480p, 720p] } }
 *       - { name: filename, in: path, required: true, schema: { type: string } }
 *       - { name: exp, in: query, required: true, schema: { type: integer } }
 *       - { name: uid, in: query, required: true, schema: { type: string } }
 *       - { name: sig, in: query, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: "Shifrlangan .ts bo'lak" }
 *       403: { description: "Imzo noto'g'ri yoki muddati o'tgan" }
 *       404: { description: 'Topilmadi' }
 */
router.get('/hls/:lessonId/:variant/seg/:filename', mediaLimiter, hlsController.getSegment);

/**
 * @swagger
 * /media/hls/{lessonId}/key:
 *   get:
 *     summary: HLS shifrlash kaliti — FAQAT Authorization bilan, imzo yetarli emas
 *     tags: [Media]
 *     description: >
 *       `sig`/`exp` qabul qilinmaydi — har safar `Authorization: Bearer <token>` orqali
 *       jonli (DB'dan) kursga yozilganlik tekshiriladi. Daqiqasiga 30 so'rov bilan
 *       cheklangan.
 *     parameters:
 *       - { name: lessonId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: '16 baytlik AES-128 kalit (application/octet-stream)' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { description: "Kursga yozilmagan/ruxsat yo'q" }
 *       404: { description: 'Kalit topilmadi' }
 *       429: { description: "Juda ko'p so'rov (daqiqasiga 30 so'rovdan ko'p)" }
 */
router.get('/hls/:lessonId/key', authenticate, keyLimiter, hlsController.getKey);

module.exports = router;
