// src/modules/media/media.routes.js

const express = require('express');
const router = express.Router();
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const mediaController = require('./media.controller');

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
 *       ichida tayyor keladi; frontend bu havolani o'zgartirmasdan ishlatadi. Havola 15
 *       daqiqadan keyin eskiradi (403). Video oldinga surish uchun Range so'rovlari
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

module.exports = router;
