// src/modules/payment/payment.validation.js

const { body } = require('express-validator');

const createPaymentValidation = [
  body('purpose')
    .optional({ checkFalsy: true })
    .isIn(['wallet', 'course', 'premium'])
    .withMessage("purpose 'wallet', 'course' yoki 'premium' bo'lishi kerak"),

  body('courseId')
    .if(body('purpose').equals('course'))
    .notEmpty()
    .withMessage("purpose='course' uchun courseId kiritilishi shart")
    .bail()
    .isMongoId()
    .withMessage("courseId noto'g'ri format"),

  body('amount')
    .if(body('purpose').not().isIn(['course', 'premium']))
    .notEmpty()
    .withMessage("To'lov summasi (amount) kiritilishi shart")
    .bail()
    .isInt({ min: 1000 })
    .withMessage("amount kamida 1000 (tiyin) bo'lishi kerak"),

  body('promoCode')
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("promoCode noto'g'ri format"),

  body('returnUrl')
    .optional({ checkFalsy: true })
    .isURL({ require_tld: false })
    .withMessage("returnUrl formati noto'g'ri"),
];

module.exports = { createPaymentValidation };
