// src/modules/books/book.validation.js

const { body } = require('express-validator');

const bookValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Kitob nomi kiritilishi shart')
    .bail()
    .isLength({ min: 2, max: 150 })
    .withMessage("Nom 2-150 ta belgi bo'lishi kerak"),

  body('author')
    .trim()
    .notEmpty()
    .withMessage('Muallif kiritilishi shart')
    .bail()
    .isLength({ min: 2, max: 100 })
    .withMessage("Muallif nomi 2-100 ta belgi bo'lishi kerak"),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Tavsif 2000 ta belgidan oshmasligi kerak"),

  body('category')
    .notEmpty()
    .withMessage('Kategoriya kiritilishi shart')
    .bail()
    .isMongoId()
    .withMessage("category noto'g'ri format"),

  body('grade')
    .optional()
    .isInt({ min: 1, max: 11 })
    .withMessage("grade 1-11 oralig'ida bo'lishi kerak"),
];

module.exports = { bookValidation };
