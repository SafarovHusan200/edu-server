// src/modules/payment/payment.routes.js

const express = require('express');
const router = express.Router();

const paymentController = require('./payment.controller');
const authenticate = require('../../middleware/authenticate');
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
 *               plan: { type: string, enum: [1m, 3m, 6m, 1y], description: "purpose='premium' bo'lsa majburiy — 1/3/6 oylik yoki 1 yillik reja" }
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
 *                           description: "Kalitlar: 1m, 3m, 6m, 1y"
 *                           additionalProperties:
 *                             type: object
 *                             properties:
 *                               months: { type: integer }
 *                               price: { type: integer, description: 'Jami narx, tiyinda' }
 *                               pricePerMonth: { type: integer, description: "Oyiga to'g'ri keladigan narx, tiyinda — solishtirish uchun" }
 *                               discountPercent: { type: integer, description: "1 oylik narxga nisbatan chegirma foizi" }
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

module.exports = router;
