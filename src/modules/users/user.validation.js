// src/modules/users/user.validation.js

const { body, query } = require('express-validator');
const User = require('./user.model');

// user.model.js dagi grade.letter enum'i bilan sinxron (null'siz)
const GRADE_LETTERS = User.schema.path('grade.letter').enumValues.filter(Boolean);

const updateMeValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Ism 2-50 ta belgi bo'lishi kerak"),
  // grade bu yerda qabul qilinmaydi — sinfni faqat admin/o'qituvchi PATCH /users/:id orqali o'zgartiradi
];

const changePasswordValidation = [
  body('oldPassword').optional().notEmpty().withMessage('Joriy parol kiritilishi shart'),

  body('newPassword')
    .notEmpty()
    .withMessage('Yangi parol kiritilishi shart')
    .bail()
    .isLength({ min: 6 })
    .withMessage("Parol kamida 6 ta belgi bo'lishi kerak"),
];

const createUserValidation = [
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
    .isIn(['student', 'teacher', 'admin', 'superadmin'])
    .withMessage("role noto'g'ri qiymat"),

  body('tarif')
    .optional()
    .isIn(['standart', 'premium'])
    .withMessage("tarif 'standart' yoki 'premium' bo'lishi kerak"),

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
    .isIn(['A', 'B', 'V', 'C', 'D', 'E', 'F'])
    .withMessage("Sinf harfi A, B, V, C, D, E, F dan biri bo'lishi kerak"),
];

const resetPasswordValidation = [
  body('newPassword')
    .notEmpty()
    .withMessage('Yangi parol kiritilishi shart')
    .bail()
    .isLength({ min: 6 })
    .withMessage("Parol kamida 6 ta belgi bo'lishi kerak"),
];

const setBlockedValidation = [
  body('isBlocked').isBoolean().withMessage("isBlocked true yoki false bo'lishi kerak"),
];

const updateUserValidation = [
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage("Ism 2-50 ta belgi bo'lishi kerak"),

  body('phone')
    .optional()
    .trim()
    .matches(/^\+?[0-9]{9,15}$/)
    .withMessage("Telefon raqam formati noto'g'ri"),

  body('role')
    .optional()
    .isIn(['student', 'teacher', 'admin', 'superadmin'])
    .withMessage("role noto'g'ri qiymat"),

  body('tarif')
    .optional()
    .isIn(['standart', 'premium'])
    .withMessage("tarif 'standart' yoki 'premium' bo'lishi kerak"),

  body('grade.number')
    .optional()
    .isInt({ min: 1, max: 11 })
    .withMessage("Sinf 1-11 oralig'ida bo'lishi kerak"),

  body('grade.letter')
    .optional()
    .isIn(['A', 'B', 'V', 'C', 'D', 'E', 'F'])
    .withMessage("Sinf harfi A, B, V, C, D, E, F dan biri bo'lishi kerak"),
];

const classRosterValidation = [
  query('grade')
    .notEmpty()
    .withMessage('Sinf raqami kiritilishi shart')
    .bail()
    .isInt({ min: 1, max: 11 })
    .withMessage("Sinf 1-11 oralig'ida bo'lishi kerak")
    .toInt(),

  query('gradeLetter')
    .notEmpty()
    .withMessage('Sinf harfi kiritilishi shart')
    .bail()
    .isIn(GRADE_LETTERS)
    .withMessage(`Sinf harfi ${GRADE_LETTERS.join(', ')} dan biri bo'lishi kerak`),
];

// GET /users — admin ro'yxati filtrlari. Noto'g'ri qiymat jim e'tiborsiz qoldirilmasin
// (aks holda filtr ishlamayotgandek ko'rinadi) — 422 qaytadi.
const listUsersValidation = [
  query('role')
    .optional({ values: 'falsy' })
    .isIn(['student', 'teacher', 'admin', 'superadmin'])
    .withMessage("role student, teacher, admin yoki superadmin bo'lishi kerak"),

  query('tarif')
    .optional({ values: 'falsy' })
    .isIn(['standart', 'premium'])
    .withMessage("tarif 'standart' yoki 'premium' bo'lishi kerak"),

  query(['isVerified', 'isBlocked'])
    .optional({ values: 'falsy' })
    .isIn(['true', 'false'])
    .withMessage("Qiymat true yoki false bo'lishi kerak"),

  query('grade')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 11 })
    .withMessage("Sinf 1-11 oralig'ida bo'lishi kerak"),

  query('gradeLetter')
    .optional({ values: 'falsy' })
    .customSanitizer((v) => String(v).toUpperCase())
    .isIn(GRADE_LETTERS)
    .withMessage(`Sinf harfi ${GRADE_LETTERS.join(', ')} dan biri bo'lishi kerak`),

  query('search')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Qidiruv matni 100 belgidan oshmasligi kerak"),
];

module.exports = {
  listUsersValidation,
  classRosterValidation,
  updateMeValidation,
  changePasswordValidation,
  createUserValidation,
  resetPasswordValidation,
  setBlockedValidation,
  updateUserValidation,
};
