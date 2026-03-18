// src/modules/auth/auth.validation.js

const { body } = require('express-validator');

const registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Ism kiritilishi shart')
    .bail()
    .isLength({ min: 2, max: 50 })
    .withMessage("Ism 2-50 ta belgi bo'lishi kerak"),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email kiritilishi shart')
    .bail()
    .isEmail()
    .withMessage("Email formati noto'g'ri")
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Parol kiritilishi shart')
    .bail()
    .isLength({ min: 6 })
    .withMessage("Parol kamida 6 ta belgi bo'lishi kerak"),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Telefon raqam kiritilishi shart')
    .bail()
    .matches(/^\+?[0-9]{9,15}$/)
    .withMessage("Telefon raqam formati noto'g'ri"),

  body('role')
    .trim()
    .notEmpty()
    .withMessage('Role kiritilishi shart')
    .bail()
    .isIn(['student', 'teacher', 'admin', 'superadmin'])
    .withMessage("Role faqat student yoki teacher bo'lishi mumkin"),
];

const loginValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email kiritilishi shart')
    .isEmail()
    .withMessage("Email formati noto'g'ri"),

  body('password').notEmpty().withMessage('Parol kiritilishi shart'),
];

const telegramAuthValidation = [
  body('telegramId')
    .notEmpty()
    .withMessage('Telegram ID kiritilishi shart')
    .bail()
    .isNumeric()
    .withMessage("Telegram ID raqam bo'lishi kerak"),

  body('name')
    .trim()
    .notEmpty()
    .withMessage('Ism kiritilishi shart')
    .bail()
    .isLength({ min: 2, max: 50 })
    .withMessage("Ism 2-50 ta belgi bo'lishi kerak"),

  body('phone') // ← qo'shildi
    .trim()
    .notEmpty()
    .withMessage('Telefon raqam kiritilishi shart')
    .bail()
    .matches(/^\+?[0-9]{9,15}$/)
    .withMessage("Telefon raqam formati noto'g'ri"),

  body('telegramUsername')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Username 50 ta belgidan oshmasligi kerak'),

  body('avatar').optional().isURL().withMessage("Avatar URL formati noto'g'ri"),
];

module.exports = {
  registerValidation,
  loginValidation,
  telegramAuthValidation,
};
