// src/modules/promocodes/promocode.validation.js

const { body } = require('express-validator');

const promoCodeValidation = [
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Promokod matni kiritilishi shart')
    .bail()
    .isLength({ min: 3, max: 30 })
    .withMessage("Promokod 3-30 ta belgi bo'lishi kerak"),

  body('discountPercent')
    .notEmpty()
    .withMessage('discountPercent kiritilishi shart')
    .bail()
    .isInt({ min: 1, max: 100 })
    .withMessage("discountPercent 1-100 oralig'ida bo'lishi kerak"),

  body('expiresAt').optional().isISO8601().withMessage("expiresAt sana formatida bo'lishi kerak"),

  body('maxUses')
    .optional()
    .isInt({ min: 1 })
    .withMessage("maxUses kamida 1 bo'lishi kerak"),
];

module.exports = { promoCodeValidation };
