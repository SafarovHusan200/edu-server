// src/modules/users/user.routes.js

const express = require('express');
const router = express.Router();

const userController = require('./user.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { uploadImage } = require('../../middleware/upload');
const {
  updateMeValidation,
  changePasswordValidation,
  setBlockedValidation,
  updateUserValidation,
} = require('./user.validation');

router.use(authenticate);

/**
 * @swagger
 * /users/me:
 *   patch:
 *     summary: O'z profilini yangilash
 *     tags: [Users]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 50 }
 *               grade:
 *                 type: object
 *                 properties:
 *                   number: { type: integer, minimum: 1, maximum: 11 }
 *                   letter: { type: string, enum: [A, B, C, D, E] }
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
 *                     data:
 *                       type: object
 *                       properties:
 *                         user: { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
// PATCH /api/v1/users/me
router.patch('/me', updateMeValidation, validate, userController.updateMe);

/**
 * @swagger
 * /users/me/password:
 *   patch:
 *     summary: Parolni o'zgartirish
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newPassword]
 *             properties:
 *               oldPassword: { type: string, format: password, description: "Agar foydalanuvchida parol mavjud bo'lsa majburiy" }
 *               newPassword: { type: string, format: password, minLength: 6 }
 *     responses:
 *       200:
 *         description: Parol o'zgartirildi
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
// PATCH /api/v1/users/me/password
router.patch(
  '/me/password',
  changePasswordValidation,
  validate,
  userController.changePassword
);

/**
 * @swagger
 * /users/me/avatar:
 *   post:
 *     summary: Profil rasmini yuklash
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [avatar]
 *             properties:
 *               avatar: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Avatar yuklandi
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
// POST /api/v1/users/me/avatar
router.post('/me/avatar', uploadImage('avatars').single('avatar'), userController.uploadAvatar);

/**
 * @swagger
 * /users/me/telegram/link:
 *   post:
 *     summary: Telegram ulash uchun bir martalik deep-link token yaratish
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: "Token yaratildi (t.me/<bot>?start=<token> ko'rinishida ishlatiladi)"
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// POST /api/v1/users/me/telegram/link — bot deep-link uchun bir martalik token
router.post('/me/telegram/link', userController.linkTelegram);

/**
 * @swagger
 * /users/me/telegram:
 *   delete:
 *     summary: Telegram hisobini profildan uzish
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Uzildi
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// DELETE /api/v1/users/me/telegram
router.delete('/me/telegram', userController.unlinkTelegram);

/**
 * @swagger
 * /users/leaderboard:
 *   get:
 *     summary: Diamond bo'yicha reyting jadvalini olish
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Reyting ro'yxati
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// GET /api/v1/users/leaderboard — istalgan login qilgan foydalanuvchi ko'ra oladi
// /:id dan OLDIN ro'yxatdan o'tkazilishi shart, aks holda "leaderboard" so'zi
// :id parametri sifatida ushlanib qoladi.
router.get('/leaderboard', userController.getLeaderboard);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Barcha foydalanuvchilarni olish
 *     tags: [Users]
 *     description: "Ruxsat: admin, superadmin"
 *     parameters:
 *       - { name: role, in: query, schema: { type: string, enum: [student, teacher, admin, superadmin] } }
 *       - { name: search, in: query, schema: { type: string } }
 *       - { name: page, in: query, schema: { type: integer, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, default: 10 } }
 *     responses:
 *       200:
 *         description: Foydalanuvchilar ro'yxati
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
// GET /api/v1/users — admin
router.get('/', authorize('admin', 'superadmin'), userController.getUsers);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Foydalanuvchini ID bo'yicha olish
 *     tags: [Users]
 *     description: "Ruxsat: admin, superadmin"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       200:
 *         description: Foydalanuvchi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// GET /api/v1/users/:id — admin
router.get('/:id', authorize('admin', 'superadmin'), userController.getUserById);

/**
 * @swagger
 * /users/{id}/block:
 *   patch:
 *     summary: Foydalanuvchini bloklash/blokdan chiqarish
 *     tags: [Users]
 *     description: "Ruxsat: admin, superadmin"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isBlocked]
 *             properties:
 *               isBlocked: { type: boolean }
 *     responses:
 *       200:
 *         description: Holat o'zgartirildi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
// PATCH /api/v1/users/:id/block — admin
router.patch(
  '/:id/block',
  authorize('admin', 'superadmin'),
  setBlockedValidation,
  validate,
  userController.setBlocked
);

/**
 * @swagger
 * /users/{id}:
 *   patch:
 *     summary: Foydalanuvchini yangilash (rolni o'zgartirish shu jumladan)
 *     tags: [Users]
 *     description: "Ruxsat: superadmin"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 50 }
 *               phone: { type: string }
 *               role: { type: string, enum: [student, teacher, admin, superadmin] }
 *               tarif: { type: string, enum: [standart, premium] }
 *               grade:
 *                 type: object
 *                 properties:
 *                   number: { type: integer, minimum: 1, maximum: 11 }
 *                   letter: { type: string, enum: [A, B, C, D, E] }
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
 *                     data: { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
// PATCH /api/v1/users/:id — superadmin (rol o'zgartirish shu jumladan)
router.patch(
  '/:id',
  authorize('superadmin'),
  updateUserValidation,
  validate,
  userController.updateUser
);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Foydalanuvchini o'chirish
 *     tags: [Users]
 *     description: "Ruxsat: superadmin"
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
// DELETE /api/v1/users/:id — superadmin
router.delete('/:id', authorize('superadmin'), userController.deleteUser);

module.exports = router;
