// src/modules/spin-questions/spinQuestion.validation.js

const { body } = require('express-validator');

const spinQuestionValidation = [
  body('grade')
    .notEmpty()
    .withMessage('grade kiritilishi shart')
    .bail()
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
