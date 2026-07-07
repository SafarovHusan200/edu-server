// src/modules/reviews/review.controller.js

const reviewService = require('./review.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

// POST /api/v1/courses/:id/reviews
const createReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;

  const review = await reviewService.createReview(req.params.id, req.user.id, { rating, comment });

  res.status(201).json(new ApiResponse(201, 'Sharh qoldirildi', { review }));
});

// GET /api/v1/courses/:id/reviews
const getReviewsByCourse = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;

  const { reviews, meta } = await reviewService.getReviewsByCourse(req.params.id, { page, limit });

  res.status(200).json(new ApiResponse(200, "Sharhlar ro'yxati", { reviews, meta }));
});

// PATCH /api/v1/reviews/:id
const updateReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;

  const review = await reviewService.updateReview(req.params.id, req.user.id, { rating, comment });

  res.status(200).json(new ApiResponse(200, 'Sharh yangilandi', { review }));
});

// DELETE /api/v1/reviews/:id
const deleteReview = asyncHandler(async (req, res) => {
  await reviewService.deleteReview(req.params.id, req.user.id, req.user.role);

  res.status(200).json(new ApiResponse(200, "Sharh o'chirildi"));
});

module.exports = {
  createReview,
  getReviewsByCourse,
  updateReview,
  deleteReview,
};
