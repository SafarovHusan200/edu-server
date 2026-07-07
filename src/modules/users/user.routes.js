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
} = require('./user.validation');

router.use(authenticate);

// PATCH /api/v1/users/me
router.patch('/me', updateMeValidation, validate, userController.updateMe);

// PATCH /api/v1/users/me/password
router.patch(
  '/me/password',
  changePasswordValidation,
  validate,
  userController.changePassword
);

// POST /api/v1/users/me/avatar
router.post('/me/avatar', uploadImage('avatars').single('avatar'), userController.uploadAvatar);

// GET /api/v1/users/leaderboard — istalgan login qilgan foydalanuvchi ko'ra oladi
// /:id dan OLDIN ro'yxatdan o'tkazilishi shart, aks holda "leaderboard" so'zi
// :id parametri sifatida ushlanib qoladi.
router.get('/leaderboard', userController.getLeaderboard);

// GET /api/v1/users — admin
router.get('/', authorize('admin', 'superadmin'), userController.getUsers);

// GET /api/v1/users/:id — admin
router.get('/:id', authorize('admin', 'superadmin'), userController.getUserById);

// PATCH /api/v1/users/:id/block — admin
router.patch(
  '/:id/block',
  authorize('admin', 'superadmin'),
  setBlockedValidation,
  validate,
  userController.setBlocked
);

module.exports = router;
