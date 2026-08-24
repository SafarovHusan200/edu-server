// src/modules/promocodes/promocode.routes.js

const express = require('express');
const router = express.Router();

const promocodeController = require('./promocode.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { promoCodeValidation } = require('./promocode.validation');

const STAFF_ROLES = ['admin', 'superadmin'];

/**
 * @swagger
 * /promo-codes/preview:
 *   get:
 *     summary: Promokod chegirmasini oldindan hisoblash
 *     tags: [PromoCodes]
 *     security: []
 *     parameters:
 *       - { name: code, in: query, required: true, schema: { type: string } }
 *       - { name: purpose, in: query, schema: { type: string, enum: [wallet, course, premium, donation] } }
 *       - { name: courseId, in: query, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Chegirma ma'lumoti
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// GET /api/v1/promo-codes/preview?code=&purpose=&courseId= — public
router.get('/preview', promocodeController.previewDiscount);

/**
 * @swagger
 * /promo-codes:
 *   post:
 *     summary: Yangi promokod yaratish
 *     tags: [PromoCodes]
 *     description: "Ruxsat: admin, superadmin"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, discountPercent]
 *             properties:
 *               code: { type: string, minLength: 3, maxLength: 30, example: 'EDU2026' }
 *               discountPercent: { type: integer, minimum: 1, maximum: 100 }
 *               expiresAt: { type: string, format: date-time }
 *               maxUses: { type: integer, minimum: 1 }
 *     responses:
 *       201:
 *         description: Yaratildi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/PromoCode' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
// POST /api/v1/promo-codes — admin
router.post(
  '/',
  authenticate,
  authorize(...STAFF_ROLES),
  promoCodeValidation,
  validate,
  promocodeController.createPromoCode
);

/**
 * @swagger
 * /promo-codes:
 *   get:
 *     summary: Barcha promokodlarni olish
 *     tags: [PromoCodes]
 *     description: "Ruxsat: admin, superadmin"
 *     responses:
 *       200:
 *         description: Promokodlar ro'yxati
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/PromoCode' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
// GET /api/v1/promo-codes — admin
router.get('/', authenticate, authorize(...STAFF_ROLES), promocodeController.getPromoCodes);

/**
 * @swagger
 * /promo-codes/{id}:
 *   patch:
 *     summary: Promokodni yangilash
 *     tags: [PromoCodes]
 *     description: "Ruxsat: admin, superadmin"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               discountPercent: { type: integer, minimum: 1, maximum: 100 }
 *               expiresAt: { type: string, format: date-time }
 *               maxUses: { type: integer, minimum: 1 }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Yangilandi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/PromoCode' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// PATCH /api/v1/promo-codes/:id — admin
router.patch('/:id', authenticate, authorize(...STAFF_ROLES), promocodeController.updatePromoCode);

/**
 * @swagger
 * /promo-codes/{id}:
 *   delete:
 *     summary: Promokodni o'chirish
 *     tags: [PromoCodes]
 *     description: "Ruxsat: admin, superadmin"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       200:
 *         description: O'chirildi
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// DELETE /api/v1/promo-codes/:id — admin
router.delete('/:id', authenticate, authorize(...STAFF_ROLES), promocodeController.deletePromoCode);

module.exports = router;
