// src/modules/live-quiz/liveQuiz.routes.js
// Jonli viktorina REST qismi: savollar to'plamini boshqarish, o'yin (PIN) yaratish, natijalar.
// O'yinning o'zi (qo'shilish, savollar, javoblar) — Socket.IO, /live-quiz namespace
// (liveQuiz.socket.js'dagi izohga qarang).

const express = require('express');
const router = express.Router();

const controller = require('./liveQuiz.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { uploadImage } = require('../../middleware/upload');
const {
  createLiveQuizValidation,
  updateLiveQuizValidation,
} = require('./liveQuiz.validation');

const HOST_ROLES = ['teacher', 'admin', 'superadmin'];
const hostOnly = [authenticate, authorize(...HOST_ROLES)];

/**
 * @swagger
 * /live-quizzes/join/{pin}:
 *   get:
 *     summary: PIN bo'yicha o'yinni tekshirish (ishtirokchi sahifasi)
 *     tags: [LiveQuiz]
 *     security: []
 *     description: >
 *       Public — akkaunt shart emas. Ishtirokchi PIN kiritganda o'yin borligini va
 *       qo'shilish mumkinligini (joinable) tekshiradi. Keyin ism so'raladi va
 *       Socket.IO orqali `player:join` yuboriladi.
 *     parameters:
 *       - { name: pin, in: path, required: true, schema: { type: string, example: '482913' } }
 *     responses:
 *       200: { description: "pin, quizTitle, status (lobby/question/reveal), joinable, playerCount" }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/join/:pin', controller.getSessionByPin);

/**
 * @swagger
 * /live-quizzes/upload-image:
 *   post:
 *     summary: Savol uchun rasm yuklash
 *     tags: [LiveQuiz]
 *     description: "Ruxsat: teacher, admin, superadmin. Qaytgan `image` yo'lini markdown matnga `![nom](image)` qilib qo'shing (yoki savolning alohida `image` maydoniga yozing). Base64 ishlatmang. JPG/PNG/WEBP, 5MB gacha."
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image: { type: string, format: binary }
 *     responses:
 *       201: { description: "{ image: '/uploads/live-quiz/...' }" }
 */
router.post('/upload-image', ...hostOnly, uploadImage('live-quiz').single('image'), controller.uploadImage);

/**
 * @swagger
 * /live-quizzes/import/{quizId}:
 *   post:
 *     summary: Mavjud testdan jonli viktorina yaratish (nusxa)
 *     tags: [LiveQuiz]
 *     description: >
 *       Ruxsat: testning egasi (ulashib qabul qilingan testlar ham — ular o'qituvchining o'z
 *       nusxasi), admin, superadmin. multiple_choice va true_false savollar ko'chiriladi
 *       (true_false → ["To'g'ri", "Noto'g'ri"]), har biriga 20 soniya taymer qo'yiladi.
 *       open_ended, 2-4 tadan boshqa sondagi variantli yoki to'g'ri javobi belgilanmagan
 *       savollar o'tkazib yuboriladi — ular javobdagi `skipped` ro'yxatida sababi bilan qaytadi.
 *       Yangi jonli viktorina mustaqil nusxa: tahrirlash asl testga ta'sir qilmaydi.
 *     parameters:
 *       - { name: quizId, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, description: "Berilmasa — testning nomi" }
 *     responses:
 *       201: { description: "quiz, imported (soni), skipped[] ({ index, text, reason })" }
 *       400: { description: "Mos savol yo'q (code: NO_COMPATIBLE_QUESTIONS)" }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.post('/import/:quizId', ...hostOnly, controller.importFromQuiz);

/**
 * @swagger
 * /live-quizzes/results/{sessionId}:
 *   get:
 *     summary: O'tkazilgan o'yinning to'liq natijasi
 *     tags: [LiveQuiz]
 *     description: "Ruxsat: o'yinni o'tkazgan o'qituvchi, admin, superadmin. Barcha ishtirokchilar reytingi va har bir savol bo'yicha statistika."
 *     parameters:
 *       - { name: sessionId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: "session: players[] (rank, name, score, correctCount), questions[] (distribution, correctCount)" }
 */
router.get('/results/:sessionId', ...hostOnly, controller.getSessionResult);

/**
 * @swagger
 * /live-quizzes:
 *   post:
 *     summary: Jonli viktorina yaratish
 *     tags: [LiveQuiz]
 *     description: "Ruxsat: teacher, admin, superadmin"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string, maxLength: 120 }
 *               description: { type: string, maxLength: 500 }
 *               questions:
 *                 type: array
 *                 maxItems: 100
 *                 items:
 *                   type: object
 *                   required: [text, options, correctIndex]
 *                   properties:
 *                     text: { type: string, maxLength: 2000, description: "Markdown. Rasm: ![nom](/uploads/live-quiz/...) — faqat upload-image natijasi, ko'pi bilan 3 ta. Base64, tashqi havola va HTML <img> rad etiladi" }
 *                     image: { type: string, nullable: true, description: "POST /live-quizzes/upload-image natijasi" }
 *                     options: { type: array, minItems: 2, maxItems: 4, items: { type: string, maxLength: 120 } }
 *                     correctIndex: { type: integer, minimum: 0, maximum: 3 }
 *                     timeLimit: { type: integer, minimum: 5, maximum: 120, default: 20, description: soniya }
 *                     pointsMultiplier: { type: integer, enum: [0, 1, 2], default: 1, description: "0 — ballsiz, 2 — ikki barobar ball" }
 *     responses:
 *       201: { description: Yaratildi }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *   get:
 *     summary: O'zimning jonli viktorinalarim
 *     tags: [LiveQuiz]
 *     description: "Ruxsat: teacher, admin, superadmin. admin/superadmin `all=true` bilan hammaning viktorinalarini ko'radi."
 *     parameters:
 *       - { name: search, in: query, schema: { type: string } }
 *       - { name: all, in: query, schema: { type: boolean } }
 *       - { name: page, in: query, schema: { type: integer } }
 *       - { name: limit, in: query, schema: { type: integer } }
 *     responses:
 *       200: { description: "quizzes[] (title, questionCount, coverImage, updatedAt), meta" }
 */
router.post('/', ...hostOnly, createLiveQuizValidation, validate, controller.createQuiz);
router.get('/', ...hostOnly, controller.getMyQuizzes);

/**
 * @swagger
 * /live-quizzes/{id}:
 *   get:
 *     summary: Viktorinani savollari bilan olish (muharrir uchun)
 *     tags: [LiveQuiz]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 *   patch:
 *     summary: Viktorinani tahrirlash
 *     tags: [LiveQuiz]
 *     description: "`questions` yuborilsa — ro'yxat TO'LIQ almashtiriladi. Davom etayotgan o'yinga ta'sir qilmaydi."
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Yangilandi }
 *   delete:
 *     summary: Viktorinani o'chirish
 *     tags: [LiveQuiz]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: O'chirildi }
 */
router.get('/:id', ...hostOnly, controller.getQuizById);
router.patch('/:id', ...hostOnly, updateLiveQuizValidation, validate, controller.updateQuiz);
router.delete('/:id', ...hostOnly, controller.deleteQuiz);

/**
 * @swagger
 * /live-quizzes/{id}/sessions:
 *   post:
 *     summary: Jonli o'yin boshlash (PIN olish)
 *     tags: [LiveQuiz]
 *     description: >
 *       6 xonali PIN qaytaradi. Doskada PIN va QR kod (masalan `<frontend>/live?pin=482913`)
 *       ko'rsatiladi, so'ng Socket.IO orqali `host:join { pin }` yuboriladi.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       201: { description: "session: { pin, sessionId, quizTitle, totalQuestions }" }
 */
router.post('/:id/sessions', ...hostOnly, controller.startSession);

/**
 * @swagger
 * /live-quizzes/{id}/results:
 *   get:
 *     summary: Shu viktorina bo'yicha o'tkazilgan o'yinlar tarixi
 *     tags: [LiveQuiz]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: "sessions[] (pin, startedAt, endedAt, playerCount, podium), meta" }
 */
router.get('/:id/results', ...hostOnly, controller.getQuizResults);

module.exports = router;
