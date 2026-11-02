// src/modules/daily-spin/dailySpin.routes.js

const express = require('express');
const router = express.Router();

const dailySpinController = require('./dailySpin.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { answerSpinValidation } = require('./dailySpin.validation');

router.use(authenticate, authorize('student'));

/**
 * @swagger
 * /daily-spin/status:
 *   get:
 *     summary: Kunlik barabon holatini olish (aylantirmasdan)
 *     tags: [DailySpin]
 *     description: "Ruxsat: student"
 *     responses:
 *       200:
 *         description: Holat
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         streakCount: { type: integer, description: "Ketma-ket kunlar (uzilgan bo'lsa 0)" }
 *                         maxSpinsToday: { type: integer, description: "standart: 1, premium: 3" }
 *                         spinsUsedToday: { type: integer }
 *                         spinsRemainingToday: { type: integer }
 *                         canSpin: { type: boolean }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
// GET /api/v1/daily-spin/status
router.get('/status', dailySpinController.getStatus);

/**
 * @swagger
 * /daily-spin/history:
 *   get:
 *     summary: "So'nggi aylantirishlar tarixi"
 *     tags: [DailySpin]
 *     description: "Ruxsat: student. Barabon sahifasidagi \"So'nggi yutuqlar\" bloki uchun."
 *     parameters:
 *       - { name: limit, in: query, schema: { type: integer, default: 10, maximum: 50 } }
 *     responses:
 *       200:
 *         description: Tarix
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         history:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               diamondsWon: { type: integer }
 *                               correct: { type: boolean, nullable: true, description: "2026-11-02'dan oldingi yozuvlarda null" }
 *                               createdAt: { type: string, format: date-time }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
// GET /api/v1/daily-spin/history
router.get('/history', dailySpinController.getHistory);

/**
 * @swagger
 * /daily-spin/spin:
 *   post:
 *     summary: Kunlik barabonni aylantirish (savol chiqadi, diamond hali berilmaydi)
 *     tags: [DailySpin]
 *     description: >
 *       Ruxsat: student. Standart tarif kuniga 1 marta, premium kuniga 3 martagacha
 *       aylantira oladi. **YANGI (2026-11-02):** diamond darhol berilmaydi — foydalanuvchi
 *       sinfiga (grade) mos tasodifiy savol qaytadi. Aylantirish shu zahoti ishlatilgan
 *       hisoblanadi (spinsUsedToday +1). Diamond olish uchun 5 daqiqa ichida
 *       POST /daily-spin/answer orqali javob berilishi kerak.
 *     responses:
 *       200:
 *         description: Aylantirildi, savol chiqdi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         question:
 *                           type: object
 *                           properties:
 *                             _id: { type: string }
 *                             question: { type: string }
 *                             options: { type: array, items: { type: string }, minItems: 4, maxItems: 4 }
 *                         answerWithinMinutes: { type: integer, example: 5 }
 *                         streakCount: { type: integer }
 *                         spinsUsedToday: { type: integer }
 *                         spinsRemainingToday: { type: integer }
 *                         maxSpinsToday: { type: integer }
 *       400: { description: "Bugun uchun aylantirish limiti tugagan / oldingi savolga javob berilmagan / shu sinf uchun savol yo'q" }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
// POST /api/v1/daily-spin/spin
router.post('/spin', dailySpinController.spin);

/**
 * @swagger
 * /daily-spin/answer:
 *   post:
 *     summary: Barabon savoliga javob berish (to'g'ri bo'lsa diamond beriladi)
 *     tags: [DailySpin]
 *     description: >
 *       Ruxsat: student. POST /daily-spin/spin'dan keyin 5 daqiqa ichida chaqirilishi
 *       kerak — aks holda "muddati tugadi" xatosi qaytadi (aylantirish baribir
 *       ishlatilgan hisoblanadi). Noto'g'ri javobda diamond berilmaydi.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [selectedIndex]
 *             properties:
 *               selectedIndex: { type: integer, minimum: 0, maximum: 3, description: "Tanlangan variant indeksi (0-3)" }
 *     responses:
 *       200:
 *         description: Javob qabul qilindi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         correct: { type: boolean }
 *                         diamondsWon: { type: integer }
 *                         correctIndex: { type: integer, description: "To'g'ri javobning indeksi (o'rganish uchun, javob noto'g'ri bo'lsa ham ko'rsatiladi)" }
 *                         streakCount: { type: integer }
 *                         spinsUsedToday: { type: integer }
 *                         spinsRemainingToday: { type: integer }
 *                         maxSpinsToday: { type: integer }
 *       400: { description: "Avval barabonni aylantirish kerak / javob berish muddati tugagan" }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
// POST /api/v1/daily-spin/answer
router.post('/answer', answerSpinValidation, validate, dailySpinController.answer);

module.exports = router;
