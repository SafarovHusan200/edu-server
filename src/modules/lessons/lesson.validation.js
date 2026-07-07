// src/modules/lessons/lesson.validation.js

const { body } = require('express-validator');

const lessonValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Dars nomi kiritilishi shart')
    .bail()
    .isLength({ min: 3, max: 120 })
    .withMessage("Nom 3-120 ta belgi bo'lishi kerak"),

  body('description').optional().trim().isLength({ max: 1000 }),

  body('content').optional().trim(),

  body('videoUrl').optional().isURL().withMessage("videoUrl formati noto'g'ri"),

  body('order').optional().isInt({ min: 0 }).withMessage("order manfiy bo'lmagan son bo'lishi kerak"),
];

module.exports = { lessonValidation };
