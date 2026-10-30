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
  createUserValidation,
  resetPasswordValidation,
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
 *     description: "Student rolidagi foydalanuvchilar uchun `name` e'tiborga olinmaydi (o'quvchi o'z ismini o'zgartira olmaydi)"
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 50, description: "Faqat teacher/admin/superadmin uchun qo'llaniladi" }
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
 *     description: "`data.me` — so'ragan foydalanuvchining o'z o'rni (faqat role='student' bo'lsa, aks holda null). Ro'yxat qaysi sahifada bo'lishidan qat'i nazar hisoblanadi."
 *     parameters:
 *       - { name: page, in: query, schema: { type: integer, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, default: 10 } }
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
 *                       type: object
 *                       properties:
 *                         leaderboard:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/User' }
 *                         me:
 *                           type: object
 *                           nullable: true
 *                           properties:
 *                             rank: { type: integer }
 *                             diamonds: { type: integer }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// GET /api/v1/users/leaderboard — istalgan login qilgan foydalanuvchi ko'ra oladi
// /:id dan OLDIN ro'yxatdan o'tkazilishi shart, aks holda "leaderboard" so'zi
// :id parametri sifatida ushlanib qoladi.
router.get('/leaderboard', userController.getLeaderboard);

/**
 * @swagger
 * /users/teachers:
 *   get:
 *     summary: "O'qituvchilarni qidirish (test ulashish uchun select/qidiruv maydoni)"
 *     tags: [Users]
 *     description: "Ruxsat: istalgan login qilgan foydalanuvchi. Faqat minimal maydonlar (ism/telefon/avatar) qaytadi, o'zi natijaga kirmaydi."
 *     parameters:
 *       - { name: search, in: query, schema: { type: string }, description: "Ism yoki telefon bo'yicha qidiruv" }
 *     responses:
 *       200:
 *         description: "O'qituvchilar ro'yxati (ko'pi bilan 20 ta)"
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
 *                         teachers:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               _id: { type: string }
 *                               name: { type: string }
 *                               phone: { type: string }
 *                               avatar: { type: string, nullable: true }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// GET /api/v1/users/teachers — /:id dan OLDIN ro'yxatdan o'tkazilishi shart
router.get('/teachers', userController.searchTeachers);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Barcha foydalanuvchilarni olish
 *     tags: [Users]
 *     description: "Ruxsat: admin, superadmin"
 *     parameters:
 *       - { name: role, in: query, schema: { type: string, enum: [student, teacher, admin, superadmin] } }
 *       - { name: isVerified, in: query, schema: { type: boolean }, description: "false — tasdiqlashni kutayotgan userlarni ko'rish uchun" }
 *       - { name: isBlocked, in: query, schema: { type: boolean }, description: "Admin paneldagi \"Bloklangan\" tabi uchun" }
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
/**
 * @swagger
 * /users:
 *   post:
 *     summary: Yangi foydalanuvchi yaratish (istalgan rolda, admin/superadmin ham)
 *     tags: [Users]
 *     description: "Ruxsat: superadmin"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, phone, password, role]
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 50 }
 *               phone: { type: string }
 *               password: { type: string, format: password, minLength: 6 }
 *               role: { type: string, enum: [student, teacher, admin, superadmin] }
 *               tarif: { type: string, enum: [standart, premium] }
 *               grade:
 *                 type: object
 *                 description: "role='student' bo'lsa majburiy"
 *                 properties:
 *                   number: { type: integer, minimum: 1, maximum: 11 }
 *                   letter: { type: string, enum: [A, B, C, D, E] }
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
 *                     data:
 *                       type: object
 *                       properties:
 *                         user: { $ref: '#/components/schemas/User' }
 *       400: { description: "Telefon raqam allaqachon ro'yxatdan o'tgan" }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
// POST /api/v1/users — superadmin
router.post(
  '/',
  authorize('superadmin'),
  createUserValidation,
  validate,
  userController.createUser
);

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
 * /users/{id}/verify:
 *   patch:
 *     summary: Ro'yxatdan o'tgan foydalanuvchini tasdiqlash (shundan keyin login qila oladi)
 *     tags: [Users]
 *     description: "Ruxsat: admin, superadmin"
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
 *                     data:
 *                       type: object
 *                       properties:
 *                         user: { $ref: '#/components/schemas/User' }
 *       400: { description: 'Foydalanuvchi allaqachon tasdiqlangan' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// PATCH /api/v1/users/:id/verify — admin, superadmin
router.patch('/:id/verify', authorize('admin', 'superadmin'), userController.verifyUser);

/**
 * @swagger
 * /users/{id}/reset-password:
 *   patch:
 *     summary: Foydalanuvchi parolini majburan tiklash (eski parol so'ralmaydi)
 *     tags: [Users]
 *     description: "Ruxsat: superadmin. Parol unutilganda ishlatiladi — eski parol tekshirilmaydi, o'zgartirilgandan so'ng foydalanuvchining boshqa qurilmalardagi sessiyalari tugatiladi va unga xabar yuboriladi"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newPassword]
 *             properties:
 *               newPassword: { type: string, format: password, minLength: 6 }
 *     responses:
 *       200:
 *         description: Parol tiklandi
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
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
// PATCH /api/v1/users/:id/reset-password — superadmin
router.patch(
  '/:id/reset-password',
  authorize('superadmin'),
  resetPasswordValidation,
  validate,
  userController.resetPassword
);

/**
 * @swagger
 * /users/{id}/avatar:
 *   post:
 *     summary: Foydalanuvchiga avatar belgilash/almashtirish
 *     tags: [Users]
 *     description: "Ruxsat: superadmin"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
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
 *         description: Avatar yangilandi
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
 *       400: { description: "Rasm fayli yuborilishi shart" }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     summary: Foydalanuvchi avatarini o'chirish
 *     tags: [Users]
 *     description: "Ruxsat: superadmin"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       200:
 *         description: Avatar o'chirildi
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
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// POST /api/v1/users/:id/avatar — superadmin
router.post(
  '/:id/avatar',
  authorize('superadmin'),
  uploadImage('avatars').single('avatar'),
  userController.setUserAvatar
);

// DELETE /api/v1/users/:id/avatar — superadmin
router.delete('/:id/avatar', authorize('superadmin'), userController.deleteUserAvatar);

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
