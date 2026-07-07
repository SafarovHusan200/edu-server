// src/modules/reviews/review.routes.js
// Yaratish/ro'yxat /courses/:id/reviews ostida (course.routes.js) — bu yerda
// faqat bitta sharhga tegishli amallar (id orqali).

const express = require('express');
const router = express.Router();

const reviewController = require('./review.controller');
const authenticate = require('../../middleware/authenticate');
const validate = require('../../middleware/validate');
const { reviewValidation } = require('./review.validation');

// PATCH /api/v1/reviews/:id
router.patch('/:id', authenticate, reviewValidation, validate, reviewController.updateReview);

// DELETE /api/v1/reviews/:id
router.delete('/:id', authenticate, reviewController.deleteReview);

module.exports = router;
