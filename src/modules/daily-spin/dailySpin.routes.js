// src/modules/daily-spin/dailySpin.routes.js

const express = require('express');
const router = express.Router();

const dailySpinController = require('./dailySpin.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');

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
 *     summary: Kunlik barabonni aylantirish (diamond yutish)
 *     tags: [DailySpin]
 *     description: "Ruxsat: student. Standart tarif kuniga 1 marta, premium kuniga 3 martagacha aylantira oladi."
 *     responses:
 *       200:
 *         description: Aylantirildi
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
 *                         diamondsWon: { type: integer }
 *                         streakCount: { type: integer }
 *                         spinsUsedToday: { type: integer }
 *                         spinsRemainingToday: { type: integer }
 *                         maxSpinsToday: { type: integer }
 *       400: { description: "Bugun uchun aylantirish limiti tugagan" }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
// POST /api/v1/daily-spin/spin
router.post('/spin', dailySpinController.spin);

module.exports = router;
