// src/modules/users/user.validation.js

const { body } = require('express-validator');

const updateMeValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Ism 2-50 ta belgi bo'lishi kerak"),

  body('grade.number')
    .optional()
    .isInt({ min: 1, max: 11 })
    .withMessage("Sinf 1-11 oralig'ida bo'lishi kerak"),

  body('grade.letter')
    .optional()
    .isIn(['A', 'B', 'C', 'D', 'E'])
    .withMessage("Sinf harfi A-E oralig'ida bo'lishi kerak"),
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

const setBlockedValidation = [
  body('isBlocked').isBoolean().withMessage("isBlocked true yoki false bo'lishi kerak"),
];

module.exports = { updateMeValidation, changePasswordValidation, setBlockedValidation };
