// src/modules/book-categories/bookCategory.validation.js

const { body } = require('express-validator');

const bookCategoryValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Kategoriya nomi kiritilishi shart')
    .bail()
    .isLength({ min: 2, max: 60 })
    .withMessage("Nom 2-60 ta belgi bo'lishi kerak"),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Tavsif 500 ta belgidan oshmasligi kerak"),

  body('icon').optional().isURL().withMessage("Icon URL formati noto'g'ri"),
];

module.exports = { bookCategoryValidation };
