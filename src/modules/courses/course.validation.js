// src/modules/courses/course.validation.js

const { body } = require('express-validator');

const courseValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Kurs nomi kiritilishi shart')
    .bail()
    .isLength({ min: 3, max: 120 })
    .withMessage("Nom 3-120 ta belgi bo'lishi kerak"),

  body('description').optional().trim().isLength({ max: 2000 }).withMessage(
    "Tavsif 2000 ta belgidan oshmasligi kerak"
  ),

  body('category')
    .notEmpty()
    .withMessage('Kategoriya kiritilishi shart')
    .bail()
    .isMongoId()
    .withMessage("category noto'g'ri format"),

  body('price')
    .optional()
    .isInt({ min: 0 })
    .withMessage("price 0 yoki musbat butun son bo'lishi kerak (tiyinda)"),
];

module.exports = { courseValidation };
