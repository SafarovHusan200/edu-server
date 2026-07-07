// src/modules/reviews/review.validation.js

const { body } = require('express-validator');

const reviewValidation = [
  body('rating')
    .notEmpty()
    .withMessage('Baho (rating) kiritilishi shart')
    .bail()
    .isInt({ min: 1, max: 5 })
    .withMessage('Baho 1-5 oralig\'ida bo\'lishi kerak'),

  body('comment').optional().trim().isLength({ max: 1000 }).withMessage(
    "Izoh 1000 ta belgidan oshmasligi kerak"
  ),
];

module.exports = { reviewValidation };
