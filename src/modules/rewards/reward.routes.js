// src/modules/rewards/reward.routes.js

const express = require('express');
const router = express.Router();

const rewardController = require('./reward.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { uploadImage } = require('../../middleware/upload');
const {
  rewardValidation,
  rejectRedemptionValidation,
  deliverRedemptionValidation,
} = require('./reward.validation');

const STAFF_ROLES = ['admin', 'superadmin'];

// ───────────────────────────────────────────────────────
// REDEMPTIONS — /:id dan oldin ro'yxatdan o'tkaziladi, aks holda
// "/redemptions" so'zi :id parametri sifatida ushlanib qoladi.
// ───────────────────────────────────────────────────────

/**
 * @swagger
 * /rewards/redemptions/my:
 *   get:
 *     summary: O'zining sovg'a almashtirishlarini olish
 *     tags: [Rewards]
 *     description: "Ruxsat: student"
 *     responses:
 *       200:
 *         description: Almashtirishlar ro'yxati
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/RewardRedemption' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
// GET /api/v1/rewards/redemptions/my
router.get(
  '/redemptions/my',
  authenticate,
  authorize('student'),
  rewardController.getMyRedemptions
);

/**
 * @swagger
 * /rewards/redemptions:
 *   get:
 *     summary: Barcha sovg'a almashtirishlarini olish
 *     tags: [Rewards]
 *     description: "Ruxsat: admin, superadmin"
 *     parameters:
 *       - { name: status, in: query, schema: { type: string, enum: [pending, delivered, rejected] } }
 *     responses:
 *       200:
 *         description: Almashtirishlar ro'yxati
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/RewardRedemption' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
// GET /api/v1/rewards/redemptions — admin
router.get('/redemptions', authenticate, authorize(...STAFF_ROLES), rewardController.getAllRedemptions);

/**
 * @swagger
 * /rewards/redemptions/{id}/approve:
 *   patch:
 *     summary: "Bosqich 1: so'rovni ko'rib chiqib tasdiqlash (hali topshirilmagan)"
 *     tags: [Rewards]
 *     description: "Ruxsat: admin, superadmin. Faqat 'pending' holatidan chaqiriladi."
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       200:
 *         description: Tasdiqlandi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/RewardRedemption' }
 *       400: { description: "So'rov ko'rib chiqish bosqichida emas" }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// PATCH /api/v1/rewards/redemptions/:id/approve — admin
router.patch(
  '/redemptions/:id/approve',
  authenticate,
  authorize(...STAFF_ROLES),
  rewardController.approveRedemption
);

/**
 * @swagger
 * /rewards/redemptions/{id}/reject:
 *   patch:
 *     summary: "So'rovni rad etish ('pending' yoki 'approved' holatidan) — diamond va stock qaytariladi"
 *     tags: [Rewards]
 *     description: "Ruxsat: admin, superadmin"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, maxLength: 500 }
 *     responses:
 *       200:
 *         description: Rad etildi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/RewardRedemption' }
 *       400: { description: "So'rovni endi rad etib bo'lmaydi (allaqachon yakunlangan)" }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
// PATCH /api/v1/rewards/redemptions/:id/reject — admin
router.patch(
  '/redemptions/:id/reject',
  authenticate,
  authorize(...STAFF_ROLES),
  rejectRedemptionValidation,
  validate,
  rewardController.rejectRedemption
);

/**
 * @swagger
 * /rewards/redemptions/{id}/deliver:
 *   patch:
 *     summary: "Bosqich 2 (yakuniy): mukofot studentga jismonan topshirilgani belgilanadi"
 *     tags: [Rewards]
 *     description: "Ruxsat: admin, superadmin. Faqat 'approved' holatidan chaqiriladi."
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note: { type: string, maxLength: 500 }
 *     responses:
 *       200:
 *         description: Yetkazildi deb belgilandi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/RewardRedemption' }
 *       400: { description: "Avval so'rov tasdiqlangan (approved) bo'lishi kerak" }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
// PATCH /api/v1/rewards/redemptions/:id/deliver — admin
router.patch(
  '/redemptions/:id/deliver',
  authenticate,
  authorize(...STAFF_ROLES),
  deliverRedemptionValidation,
  validate,
  rewardController.deliverRedemption
);

// ───────────────────────────────────────────────────────
// REWARD CRUD
// ───────────────────────────────────────────────────────

/**
 * @swagger
 * /rewards:
 *   get:
 *     summary: Barcha sovg'alarni olish
 *     tags: [Rewards]
 *     security: []
 *     responses:
 *       200:
 *         description: Sovg'alar ro'yxati
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Reward' }
 */
// GET /api/v1/rewards — public
router.get('/', rewardController.getRewards);

/**
 * @swagger
 * /rewards/{id}:
 *   get:
 *     summary: Sovg'ani ID bo'yicha olish
 *     tags: [Rewards]
 *     security: []
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       200:
 *         description: Sovg'a
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Reward' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// GET /api/v1/rewards/:id — public
router.get('/:id', rewardController.getRewardById);

/**
 * @swagger
 * /rewards:
 *   post:
 *     summary: Yangi sovg'a yaratish
 *     tags: [Rewards]
 *     description: "Ruxsat: admin, superadmin"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, cost]
 *             properties:
 *               title: { type: string, minLength: 2, maxLength: 100 }
 *               description: { type: string, maxLength: 500 }
 *               cost: { type: integer, minimum: 1, description: 'Diamonddagi narxi' }
 *               stock: { type: integer, minimum: 0, nullable: true, description: 'null = cheksiz' }
 *               premiumOnly: { type: boolean, default: false, description: "true bo'lsa faqat premium studentlar almashtira oladi" }
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
 *                     data: { $ref: '#/components/schemas/Reward' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
// POST /api/v1/rewards — admin
router.post(
  '/',
  authenticate,
  authorize(...STAFF_ROLES),
  rewardValidation,
  validate,
  rewardController.createReward
);

/**
 * @swagger
 * /rewards/{id}:
 *   patch:
 *     summary: Sovg'ani yangilash
 *     tags: [Rewards]
 *     description: "Ruxsat: admin, superadmin"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               cost: { type: integer, minimum: 1 }
 *               stock: { type: integer, minimum: 0, nullable: true }
 *               isActive: { type: boolean }
 *               premiumOnly: { type: boolean }
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
 *                     data: { $ref: '#/components/schemas/Reward' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// PATCH /api/v1/rewards/:id — admin
router.patch('/:id', authenticate, authorize(...STAFF_ROLES), rewardController.updateReward);

/**
 * @swagger
 * /rewards/{id}:
 *   delete:
 *     summary: Sovg'ani o'chirish
 *     tags: [Rewards]
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
// DELETE /api/v1/rewards/:id — admin
router.delete('/:id', authenticate, authorize(...STAFF_ROLES), rewardController.deleteReward);

/**
 * @swagger
 * /rewards/{id}/image:
 *   post:
 *     summary: Sovg'a rasmini yuklash
 *     tags: [Rewards]
 *     description: "Ruxsat: admin, superadmin"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Rasm yuklandi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Reward' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
// POST /api/v1/rewards/:id/image — admin
router.post(
  '/:id/image',
  authenticate,
  authorize(...STAFF_ROLES),
  uploadImage('rewards').single('image'),
  rewardController.uploadImage
);

/**
 * @swagger
 * /rewards/{id}/redeem:
 *   post:
 *     summary: Diamondlarga sovg'a almashtirish
 *     tags: [Rewards]
 *     description: "Ruxsat: student"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       201:
 *         description: Sovg'a almashtirildi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/RewardRedemption' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { description: "Rol 'student' emas, yoki sovg'a premiumOnly va foydalanuvchi premium emas" }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// POST /api/v1/rewards/:id/redeem — student
router.post('/:id/redeem', authenticate, authorize('student'), rewardController.redeemReward);

module.exports = router;
