// src/modules/rewards/reward.validation.js

const { body, query } = require('express-validator');
const Reward = require('./reward.model');

// PATCH /rewards/reorder — rewardIds bazadagi BARCHA sovg'alarning (faol va faolsiz)
// yangi tartibi bo'lishi kerak: bo'sh emas, hammasi ObjectId, takrorsiz va bazadagi
// to'plamga aynan teng (ortiqcha yoki yetishmayotgan ID bo'lmasin)
const reorderRewardsValidation = [
  body('rewardIds')
    .isArray({ min: 1 })
    .withMessage("rewardIds bo'sh bo'lmagan massiv bo'lishi kerak")
    .bail()
    .custom((ids) => ids.every((id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)))
    .withMessage("rewardIds ichidagi barcha qiymatlar to'g'ri ID bo'lishi kerak")
    .bail()
    .custom((ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length)
    .withMessage("rewardIds ichida takrorlangan ID bor")
    .bail()
    .custom(async (ids) => {
      const existing = await Reward.find().select('_id').lean();
      const existingSet = new Set(existing.map((r) => r._id.toString()));
      const complete =
        existing.length === ids.length && ids.every((id) => existingSet.has(id.toLowerCase()));
      if (!complete) throw new Error("Ro'yxat to'liq emas");
      return true;
    }),
];

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

// GET /rewards/redemptions — userId (ixtiyoriy) aniq bitta o'quvchi bo'yicha filtr
const listRedemptionsValidation = [
  query('userId')
    .optional({ values: 'falsy' })
    .isMongoId()
    .withMessage("userId noto'g'ri formatda"),
];

module.exports = {
  reorderRewardsValidation,
  listRedemptionsValidation,
  rewardValidation,
  rejectRedemptionValidation,
  deliverRedemptionValidation,
};
