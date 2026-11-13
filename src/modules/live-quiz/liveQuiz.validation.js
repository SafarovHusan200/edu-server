// src/modules/live-quiz/liveQuiz.validation.js

const { body } = require('express-validator');
const { checkQuestionText, isOwnImage } = require('./liveQuiz.text');

const questionRules = [
  body('questions').optional().isArray({ max: 100 }).withMessage("questions massiv bo'lishi kerak (ko'pi bilan 100 ta)"),

  // Markdown matn — rasmlar faqat o'zimiz yuklagan fayllardan (liveQuiz.text.js'ga qarang)
  body('questions.*.text')
    .isString()
    .withMessage('Savol matni kiritilishi shart')
    .bail()
    .trim()
    .custom((value) => {
      const error = checkQuestionText(value);
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

  body('questions.*.options.*')
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Variant matni bo'sh bo'lmasligi kerak")
    .bail()
    .isLength({ max: 120 })
    .withMessage('Variant 120 ta belgidan oshmasligi kerak'),

  body('questions.*.correctIndex')
    .isInt({ min: 0, max: 3 })
    .withMessage("correctIndex 0-3 oralig'ida bo'lishi kerak")
    .bail()
    .custom((value, { req, path }) => {
      const i = Number(path.match(/questions\[(\d+)\]/)[1]);
      return Number(value) < (req.body.questions[i]?.options?.length ?? 0);
    })
    .withMessage("correctIndex variantlar sonidan kichik bo'lishi kerak"),

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
