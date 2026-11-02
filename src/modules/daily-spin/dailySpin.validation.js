// src/modules/daily-spin/dailySpin.validation.js

const { body } = require('express-validator');

const answerSpinValidation = [
  body('selectedIndex')
    .notEmpty()
    .withMessage('selectedIndex kiritilishi shart')
    .bail()
    .isInt({ min: 0, max: 3 })
    .withMessage("selectedIndex 0-3 oralig'ida bo'lishi kerak"),
];

module.exports = { answerSpinValidation };
