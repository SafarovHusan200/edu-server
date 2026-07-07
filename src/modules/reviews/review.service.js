// src/modules/reviews/review.service.js

const mongoose = require('mongoose');
const Review = require('./review.model');
const Course = require('../courses/course.model');
const enrollmentService = require('../enrollment/enrollment.service');
const ApiError = require('../../utils/ApiError');
const { getPagination, buildMeta } = require('../../utils/paginate');

const recalculateRating = async (courseId) => {
  const [stats] = await Review.aggregate([
    { $match: { course: new mongoose.Types.ObjectId(courseId) } },
    { $group: { _id: '$course', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  await Course.findByIdAndUpdate(courseId, {
    ratingAvg: stats ? Math.round(stats.avg * 10) / 10 : 0,
    ratingCount: stats ? stats.count : 0,
  });
};

const createReview = async (courseId, studentId, { rating, comment }) => {
  const course = await Course.findById(courseId);
  if (!course) throw new ApiError(404, 'Kurs topilmadi');

  const canReview = await enrollmentService.hasActiveAccess(courseId, studentId);
  if (!canReview) {
    throw new ApiError(403, "Faqat kursga yozilgan studentlar sharh qoldira oladi");
  }

  const existing = await Review.findOne({ course: courseId, student: studentId });
  if (existing) {
    throw new ApiError(400, "Siz bu kursga allaqachon sharh qoldirgansiz");
  }

  const review = await Review.create({ course: courseId, student: studentId, rating, comment });
  await recalculateRating(courseId);

  return review;
};

const getReviewsByCourse = async (courseId, { page, limit }) => {
  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });
  const filter = { course: courseId };

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .populate('student', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageLimit),
    Review.countDocuments(filter),
  ]);

  return { reviews, meta: buildMeta(total, currentPage, pageLimit) };
};

const updateReview = async (reviewId, studentId, { rating, comment }) => {
  const review = await Review.findById(reviewId);
  if (!review) throw new ApiError(404, 'Sharh topilmadi');

  if (review.student.toString() !== studentId.toString()) {
    throw new ApiError(403, 'Siz bu sharhni tahrirlay olmaysiz');
  }

  if (rating !== undefined) review.rating = rating;
  if (comment !== undefined) review.comment = comment;
  await review.save();

  await recalculateRating(review.course);
  return review;
};

const deleteReview = async (reviewId, userId, role) => {
  const review = await Review.findById(reviewId);
  if (!review) throw new ApiError(404, 'Sharh topilmadi');

  const isOwner = review.student.toString() === userId.toString();
  const isAdmin = ['admin', 'superadmin'].includes(role);

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "Siz bu sharhni o'chira olmaysiz");
  }

  const { course } = review;
  await review.deleteOne();
  await recalculateRating(course);
};

module.exports = {
  createReview,
  getReviewsByCourse,
  updateReview,
  deleteReview,
};
