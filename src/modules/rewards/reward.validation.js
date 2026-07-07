// src/modules/rewards/reward.validation.js

const { body } = require('express-validator');

const rewardValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage("Sovg'a nomi kiritilishi shart")
    .bail()
    .isLength({ min: 2, max: 100 })
    .withMessage("Nom 2-100 ta belgi bo'lishi kerak"),

  body('description').optional().trim().isLength({ max: 500 }),

  body('cost')
    .notEmpty()
    .withMessage("Narx (cost) kiritilishi shart")
    .bail()
    .isInt({ min: 1 })
    .withMessage("cost kamida 1 diamant bo'lishi kerak"),

  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage("stock manfiy bo'lmagan son bo'lishi kerak"),
];

const updateRedemptionValidation = [
  body('status')
    .notEmpty()
    .withMessage('status kiritilishi shart')
    .bail()
    .isIn(['delivered', 'rejected'])
    .withMessage("status 'delivered' yoki 'rejected' bo'lishi kerak"),

  body('adminNote').optional().trim().isLength({ max: 500 }),
];

module.exports = { rewardValidation, updateRedemptionValidation };
