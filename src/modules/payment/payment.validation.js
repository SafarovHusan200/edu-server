// src/modules/payment/payment.validation.js

const { body } = require('express-validator');

const createPaymentValidation = [
  body('purpose')
    .optional()
    .isIn(['wallet', 'course'])
    .withMessage("purpose 'wallet' yoki 'course' bo'lishi kerak"),

  body('courseId')
    .if(body('purpose').equals('course'))
    .notEmpty()
    .withMessage("purpose='course' uchun courseId kiritilishi shart")
    .bail()
    .isMongoId()
    .withMessage("courseId noto'g'ri format"),

  body('amount')
    .if(body('purpose').not().equals('course'))
    .notEmpty()
    .withMessage("To'lov summasi (amount) kiritilishi shart")
    .bail()
    .isInt({ min: 1000 })
    .withMessage("amount kamida 1000 (tiyin) bo'lishi kerak"),

  body('returnUrl').optional().isURL().withMessage("returnUrl formati noto'g'ri"),
];

module.exports = { createPaymentValidation };
