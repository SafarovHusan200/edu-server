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
    .withMessage("cost kamida 1 diamond bo'lishi kerak"),

  // values: 'falsy' — stock:null "cheksiz miqdor" degani (modelga qarang), shuning
  // uchun optional() standart "faqat undefined" tekshiruvi buni to'xtatib qo'ymasligi kerak
  body('stock')
    .optional({ values: 'falsy' })
    .isInt({ min: 0 })
    .withMessage("stock manfiy bo'lmagan son bo'lishi kerak"),

  body('premiumOnly')
    .optional()
    .isBoolean()
    .withMessage("premiumOnly true yoki false bo'lishi kerak"),
];

const rejectRedemptionValidation = [
  body('reason').optional().trim().isLength({ max: 500 }).withMessage("Sabab 500 ta belgidan oshmasligi kerak"),
];

const deliverRedemptionValidation = [
  body('note').optional().trim().isLength({ max: 500 }).withMessage("Izoh 500 ta belgidan oshmasligi kerak"),
];

module.exports = {
  rewardValidation,
  rejectRedemptionValidation,
  deliverRedemptionValidation,
};
