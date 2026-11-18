// src/modules/live-quiz/liveQuiz.validation.js

const { body } = require('express-validator');
const { checkQuestionText, isOwnImage } = require('./liveQuiz.text');

// DIQQAT: wildcard ("questions.*.x") zanjirlarida .bail() ishlatilmaydi — express-validator 7 da
// bitta savoldagi xato bail orqali QOLGAN savollar tekshiruvini ham to'xtatadi.
// Shuning uchun bir nechta shart bitta custom() ichida tekshiriladi.
const questionRules = [
  body('questions').optional().isArray({ max: 100 }).withMessage("questions massiv bo'lishi kerak (ko'pi bilan 100 ta)"),

  // Markdown matn — rasmlar faqat o'zimiz yuklagan fayllardan (liveQuiz.text.js'ga qarang)
  body('questions.*.text').custom((value) => {
    const error = checkQuestionText(typeof value === 'string' ? value.trim() : value);
    if (error) throw new Error(error);
    return true;
  }),

  // Ixtiyoriy alohida rasm (masalan muqova yoki matndan tashqari katta rasm)
  body('questions.*.image')
    .optional({ values: 'null' })
    .isString()
    .custom(isOwnImage)
    .withMessage("Rasm POST /live-quizzes/upload-image orqali yuklangan bo'lishi kerak"),

  body('questions.*.options')
    .isArray({ min: 2, max: 4 })
    .withMessage("Variantlar soni 2-4 ta bo'lishi kerak"),

  body('questions.*.options.*').custom((value) => {
    if (typeof value !== 'string' || !value.trim()) throw new Error("Variant matni bo'sh bo'lmasligi kerak");
    if (value.trim().length > 120) throw new Error('Variant 120 ta belgidan oshmasligi kerak');
    return true;
  }),

  body('questions.*.correctIndex').custom((value, { req, path }) => {
    const n = Number(value);
    if (value === null || value === '' || typeof value === 'boolean' || !Number.isInteger(n) || n < 0 || n > 3) {
      throw new Error("correctIndex 0-3 oralig'ida bo'lishi kerak");
    }
    const i = Number(path.match(/questions\[(\d+)\]/)[1]);
    if (n >= (req.body.questions[i]?.options?.length ?? 0)) {
      throw new Error("correctIndex variantlar sonidan kichik bo'lishi kerak");
    }
    return true;
  }),

  body('questions.*.timeLimit')
    .optional()
    .isInt({ min: 5, max: 120 })
    .withMessage("timeLimit 5-120 soniya oralig'ida bo'lishi kerak"),

  body('questions.*.pointsMultiplier')
    .optional()
    .isIn([0, 1, 2])
    .withMessage("pointsMultiplier 0, 1 yoki 2 bo'lishi kerak"),
];

const createLiveQuizValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Viktorina nomi kiritilishi shart')
    .bail()
    .isLength({ max: 120 })
    .withMessage('Nom 120 ta belgidan oshmasligi kerak'),
  body('description').optional().trim().isLength({ max: 500 }),
  ...questionRules,
];

const updateLiveQuizValidation = [
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Nom bo'sh bo'lmasligi kerak")
    .bail()
    .isLength({ max: 120 }),
  body('description').optional().trim().isLength({ max: 500 }),
  ...questionRules,
];

module.exports = { createLiveQuizValidation, updateLiveQuizValidation };
