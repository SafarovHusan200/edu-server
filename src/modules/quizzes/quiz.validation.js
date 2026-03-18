// src/modules/quizzes/quiz.validation.js

const { body } = require('express-validator');

const quizValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Quiz nomi kiritilishi shart')
    .bail()
    .isLength({ min: 3, max: 100 })
    .withMessage("Nom 3-100 ta belgi bo'lishi kerak"),

  body('targetType')
    .notEmpty()
    .withMessage('targetType kiritilishi shart')
    .bail()
    .isIn(['course', 'lesson', 'standalone'])
    .withMessage("targetType: course, lesson yoki standalone bo'lishi kerak"),

  body('targetId')
    .if(body('targetType').isIn(['course', 'lesson']))
    .notEmpty()
    .withMessage('Course yoki Lesson uchun targetId kiritilishi shart')
    .bail()
    .isMongoId()
    .withMessage("targetId noto'g'ri format"),

  body('passingScore')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage("passingScore 0-100 oralig'ida bo'lishi kerak"),

  body('maxAttempts')
    .optional()
    .isInt({ min: 1 })
    .withMessage("maxAttempts kamida 1 bo'lishi kerak"),

  body('timeLimit')
    .optional()
    .isInt({ min: 1 })
    .withMessage("timeLimit kamida 1 daqiqa bo'lishi kerak"),
];

const questionValidation = [
  body('text').trim().notEmpty().withMessage('Savol matni kiritilishi shart'),

  body('type')
    .notEmpty()
    .withMessage('Savol turi kiritilishi shart')
    .bail()
    .isIn(['multiple_choice', 'true_false', 'open_ended'])
    .withMessage("Noto'g'ri savol turi"),

  body('options')
    .if(body('type').equals('multiple_choice'))
    .isArray({ min: 2 })
    .withMessage('Multiple choice uchun kamida 2 ta variant kerak'),

  body('correctAnswer')
    .if(body('type').isIn(['multiple_choice', 'true_false']))
    .notEmpty()
    .withMessage("To'g'ri javob kiritilishi shart"),

  // ← qo'shildi
  body('sampleAnswer')
    .if(body('type').equals('open_ended'))
    .optional()
    .isString()
    .withMessage("sampleAnswer matn bo'lishi kerak")
    .bail()
    .isLength({ max: 1000 })
    .withMessage('sampleAnswer 1000 ta belgidan oshmasligi kerak'),

  body('points').optional().isInt({ min: 1 }).withMessage("Ball kamida 1 bo'lishi kerak"),
];

const submitValidation = [
  body('answers').isArray({ min: 1 }).withMessage("Kamida 1 ta javob bo'lishi kerak"),

  body('answers.*.questionId')
    .notEmpty()
    .withMessage('questionId kiritilishi shart')
    .bail()
    .isMongoId()
    .withMessage("questionId noto'g'ri format"),

  body('answers.*.givenAnswer').notEmpty().withMessage('givenAnswer kiritilishi shart'),
];

module.exports = {
  quizValidation,
  questionValidation,
  submitValidation,
};
