// src/modules/payment/payment.routes.js

const express = require('express');
const router = express.Router();

const paymentController = require('./payment.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { createPaymentValidation } = require('./payment.validation');

/**
 * @swagger
 * /payment/create:
 *   post:
 *     summary: Multicard orqali to'lov yaratish
 *     tags: [Payment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               purpose: { type: string, enum: [wallet, course, premium, donation], default: wallet }
 *               courseId: { type: string, description: "purpose='course' bo'lsa majburiy" }
 *               plan: { type: string, enum: [30d, 90d, 180d, 365d], description: "purpose='premium' bo'lsa majburiy — 30/90/180/365 kunlik reja" }
 *               amount: { type: integer, minimum: 1000, description: "Tiyinda; purpose 'course'/'premium' bo'lmasa majburiy" }
 *               promoCode: { type: string, minLength: 3, maxLength: 30, description: "Faqat purpose='premium' bo'lganda ishlaydi, aks holda 400 xato qaytadi" }
 *               returnUrl: { type: string, format: uri }
 *     responses:
 *       201:
 *         description: To'lov yaratildi (to'lov sahifasi linki bilan)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Payment' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
// POST /api/v1/payment/create — Private (foydalanuvchi login qilgan bo'lishi kerak)
router.post(
  '/create',
  authenticate,
  createPaymentValidation,
  validate,
  paymentController.createPayment
);

/**
 * @swagger
 * /payment/premium-plans:
 *   get:
 *     summary: Premium tarif rejalari va narxlarini olish
 *     tags: [Payment]
 *     security: []
 *     responses:
 *       200:
 *         description: Rejalar ro'yxati
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
 *                         plans:
 *                           type: object
 *                           description: "Kalitlar: 30d, 90d, 180d, 365d"
 *                           additionalProperties:
 *                             type: object
 *                             properties:
 *                               days: { type: integer, description: "Muddat, kunlarda" }
 *                               price: { type: integer, description: 'Jami narx, tiyinda' }
 *                               pricePerMonth: { type: integer, description: "~30 kunga to'g'ri keladigan narx, tiyinda — solishtirish uchun" }
 *                               discountPercent: { type: integer, description: "30 kunlik narxga nisbatan chegirma foizi" }
 */
// GET /api/v1/payment/premium-plans — Public
router.get('/premium-plans', paymentController.getPremiumPlans);

/**
 * @swagger
 * /payment/callback:
 *   post:
 *     summary: Multicard webhook callback (tashqi, token'siz)
 *     tags: [Payment]
 *     security: []
 *     description: "Bu endpoint Multicard server tomonidan chaqiriladi, frontend uchun emas."
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       200:
 *         description: Callback qabul qilindi
 */
// POST /api/v1/payment/callback — Public
// DIQQAT: bu route auth/CSRF middleware'siz qoldirilishi SHART,
// chunki Multicard server tashqi tomondan (token'siz) so'rov yuboradi.
router.post('/callback', paymentController.handleCallback);

/**
 * @swagger
 * /payment/status/{invoiceId}:
 *   get:
 *     summary: To'lov holatini olish
 *     tags: [Payment]
 *     parameters:
 *       - { name: invoiceId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: To'lov holati
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Payment' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// GET /api/v1/payment/status/:invoiceId — Private
router.get('/status/:invoiceId', authenticate, paymentController.getPaymentStatus);

/**
 * @swagger
 * /payment/my:
 *   get:
 *     summary: O'zining to'lovlar tarixini olish
 *     tags: [Payment]
 *     parameters:
 *       - { name: purpose, in: query, schema: { type: string, enum: [wallet, course, premium, donation] } }
 *       - { name: status, in: query, schema: { type: string, enum: [draft, progress, billing, hold, success, error, revert] } }
 *       - { name: page, in: query, schema: { type: integer, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, default: 10 } }
 *     responses:
 *       200:
 *         description: To'lovlar ro'yxati
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Payment' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// GET /api/v1/payment/my — Private
router.get('/my', authenticate, paymentController.getMyPayments);

/**
 * @swagger
 * /payment:
 *   get:
 *     summary: Barcha to'lovlarni olish
 *     tags: [Payment]
 *     description: "Ruxsat: admin, superadmin. Masalan 'draft' holatida tiqilib qolgan to'lovlarni topish uchun ham foydali."
 *     parameters:
 *       - { name: userId, in: query, schema: { type: string } }
 *       - { name: purpose, in: query, schema: { type: string, enum: [wallet, course, premium, donation] } }
 *       - { name: status, in: query, schema: { type: string, enum: [draft, progress, billing, hold, success, error, revert] } }
 *       - { name: page, in: query, schema: { type: integer, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, default: 10 } }
 *     responses:
 *       200:
 *         description: To'lovlar ro'yxati
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Payment' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
// GET /api/v1/payment — admin, superadmin
router.get('/', authenticate, authorize('admin', 'superadmin'), paymentController.getAllPayments);

module.exports = router;
