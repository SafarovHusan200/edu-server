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

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Telefon raqam kiritilishi shart')
    .bail()
    .matches(/^\+?[0-9]{9,15}$/)
    .withMessage("Telefon raqam formati noto'g'ri"),

  body('password')
    .notEmpty()
    .withMessage('Parol kiritilishi shart')
    .bail()
    .isLength({ min: 6 })
    .withMessage("Parol kamida 6 ta belgi bo'lishi kerak"),

  body('role')
    .trim()
    .notEmpty()
    .withMessage('Role kiritilishi shart')
    .bail()
    .isIn(['student', 'teacher'])
    .withMessage("Role faqat student yoki teacher bo'lishi mumkin"),

  body('grade.number')
    .if(body('role').equals('student'))
    .notEmpty()
    .withMessage('Sinf raqami kiritilishi shart')
    .bail()
    .isInt({ min: 1, max: 11 })
    .withMessage("Sinf 1-11 oralig'ida bo'lishi kerak"),

  body('grade.letter')
    .if(body('role').equals('student'))
    .notEmpty()
    .withMessage('Sinf harfi kiritilishi shart')
    .bail()
    .isIn(['A', 'B', 'C', 'D', 'E'])
    .withMessage("Sinf harfi A-E oralig'ida bo'lishi kerak"),
];

const loginValidation = [
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Telefon raqam kiritilishi shart')
    .bail()
    .matches(/^\+?[0-9]{9,15}$/)
    .withMessage("Telefon raqam formati noto'g'ri"),

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

const verifyOtpValidation = [
  body('code')
    .notEmpty()
    .withMessage('Kod kiritilishi shart')
    .bail()
    .isLength({ min: 6, max: 6 })
    .withMessage("Kod 6 ta raqamdan iborat bo'lishi kerak"),
];

module.exports = {
  registerValidation,
  loginValidation,
  telegramAuthValidation,
  verifyOtpValidation,
};
