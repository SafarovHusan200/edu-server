// src/modules/spin-questions/spinQuestion.validation.js

const { body } = require('express-validator');

// category='knowledge' bo'lsa grade (1-11) majburiy, category='logic' bo'lsa grade
// umuman kerak emas (yuborilsa ham e'tiborga olinmaydi — model darajasida null qilinadi)
const gradeRequiredForKnowledge = (value, { req }) => {
  if (req.body.category === 'logic') return true;
  return value !== undefined && value !== null && value !== '';
};

const spinQuestionValidation = [
  body('category').optional().isIn(['knowledge', 'logic']).withMessage("category 'knowledge' yoki 'logic' bo'lishi kerak"),

  body('grade')
    .custom(gradeRequiredForKnowledge)
    .withMessage("category='knowledge' uchun grade (1-11) kiritilishi shart")
    .bail()
    .if((value) => value !== undefined && value !== null && value !== '')
    .isInt({ min: 1, max: 11 })
    .withMessage("grade 1-11 oralig'ida bo'lishi kerak"),

  body('question')
    .trim()
    .notEmpty()
    .withMessage('question kiritilishi shart'),

  body('options')
    .isArray({ min: 4, max: 4 })
    .withMessage("options aynan 4 ta variantdan iborat bo'lishi kerak")
    .bail()
    .custom((arr) => arr.every((o) => typeof o === 'string' && o.trim()))
    .withMessage("Har bir variant bo'sh bo'lmagan matn bo'lishi kerak"),

  body('correctIndex')
    .notEmpty()
    .withMessage('correctIndex kiritilishi shart')
    .bail()
    .isInt({ min: 0, max: 3 })
    .withMessage("correctIndex 0-3 oralig'ida bo'lishi kerak"),

  body('isActive').optional().isBoolean().withMessage("isActive true/false bo'lishi kerak"),
];

const updateSpinQuestionValidation = [
  body('category').optional().isIn(['knowledge', 'logic']).withMessage("category 'knowledge' yoki 'logic' bo'lishi kerak"),

  body('grade').optional().isInt({ min: 1, max: 11 }).withMessage("grade 1-11 oralig'ida bo'lishi kerak"),

  body('question').optional().trim().notEmpty().withMessage("question bo'sh bo'lmasligi kerak"),

  body('options')
    .optional()
    .isArray({ min: 4, max: 4 })
    .withMessage("options aynan 4 ta variantdan iborat bo'lishi kerak")
    .bail()
    .custom((arr) => arr.every((o) => typeof o === 'string' && o.trim()))
    .withMessage("Har bir variant bo'sh bo'lmagan matn bo'lishi kerak"),

  body('correctIndex').optional().isInt({ min: 0, max: 3 }).withMessage("correctIndex 0-3 oralig'ida bo'lishi kerak"),

  body('isActive').optional().isBoolean().withMessage("isActive true/false bo'lishi kerak"),
];

module.exports = { spinQuestionValidation, updateSpinQuestionValidation };
