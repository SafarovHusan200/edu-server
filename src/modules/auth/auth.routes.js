const express = require('express');
const router = express.Router();
const { validationResult } = require('express-validator');

const authController = require('./auth.controller');
const authenticate = require('../../middleware/authenticate');
const { authLimiter } = require('../../middleware/rateLimiter');
const {
  registerValidation,
  loginValidation,
  telegramAuthValidation,
  verifyOtpValidation,
} = require('./auth.validation');

// ─────────────────────────────────────────
// Validation middleware
// ─────────────────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      statusCode: 422,
      message: 'Validatsiya xatosi',
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

// ─────────────────────────────────────────
// Routes
// ─────────────────────────────────────────

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Ro'yxatdan o'tish
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, phone, password, role]
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 50, example: 'Aliyev Vali' }
 *               phone: { type: string, example: '+998901234567' }
 *               password: { type: string, minLength: 6, format: password }
 *               role: { type: string, enum: [student, teacher] }
 *               grade:
 *                 type: object
 *                 description: role='student' bo'lsa majburiy
 *                 properties:
 *                   number: { type: integer, minimum: 1, maximum: 11 }
 *                   letter: { type: string, enum: [A, B, C, D, E] }
 *     responses:
 *       201:
 *         description: Muvaffaqiyatli ro'yxatdan o'tildi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/AuthPayload' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
// POST /api/v1/auth/register
router.post('/register', authLimiter, registerValidation, validate, authController.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Telefon va parol orqali tizimga kirish
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, password]
 *             properties:
 *               phone: { type: string, example: '+998901234567' }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Muvaffaqiyatli kirildi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/AuthPayload' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
// POST /api/v1/auth/login
router.post('/login', authLimiter, loginValidation, validate, authController.login);

/**
 * @swagger
 * /auth/telegram:
 *   post:
 *     summary: Telegram bot orqali yuborilgan OTP kodni tasdiqlab kirish
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, minLength: 6, maxLength: 6, example: '123456' }
 *     responses:
 *       200:
 *         description: Muvaffaqiyatli kirildi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/AuthPayload' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
// POST /api/v1/auth/telegram/verify
router.post('/telegram', authLimiter, verifyOtpValidation, validate, authController.verifyTelegramOtp);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Joriy foydalanuvchi profilini olish
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Profil ma'lumotlari
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
 *                         user: { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// GET /api/v1/auth/me  ← Private
router.get('/me', authenticate, authController.getMe);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Tizimdan chiqish (barcha eski tokenlar bekor qilinadi)
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Tizimdan chiqildi
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// POST /api/v1/auth/logout  ← Private
router.post('/logout', authenticate, authController.logout);

module.exports = router;
