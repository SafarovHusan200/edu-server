// src/modules/courses/course.routes.js

const express = require('express');
const router = express.Router();

const courseController = require('./course.controller');
const lessonController = require('../lessons/lesson.controller');
const reviewController = require('../reviews/review.controller');

const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { uploadImage } = require('../../middleware/upload');

const { courseValidation } = require('./course.validation');
const { lessonValidation } = require('../lessons/lesson.validation');
const { reviewValidation } = require('../reviews/review.validation');

const TEACHING_ROLES = ['teacher', 'admin', 'superadmin'];

// ───────────────────────────────────────────────────────
// COURSE CRUD
// ───────────────────────────────────────────────────────

// GET /api/v1/courses — public (login bo'lsa o'zining draft kurslari ham ko'rinadi)
router.get('/', authenticate.optional, courseController.getCourses);

// GET /api/v1/courses/:id — public (login bo'lsa to'liq kontent aniqlanadi)
router.get('/:id', authenticate.optional, courseController.getCourseById);

// POST /api/v1/courses
router.post(
  '/',
  authenticate,
  authorize(...TEACHING_ROLES),
  courseValidation,
  validate,
  courseController.createCourse
);

// PATCH /api/v1/courses/:id
router.patch('/:id', authenticate, authorize(...TEACHING_ROLES), courseController.updateCourse);

// DELETE /api/v1/courses/:id
router.delete('/:id', authenticate, authorize(...TEACHING_ROLES), courseController.deleteCourse);

// POST /api/v1/courses/:id/thumbnail
router.post(
  '/:id/thumbnail',
  authenticate,
  authorize(...TEACHING_ROLES),
  uploadImage('courses').single('thumbnail'),
  courseController.uploadThumbnail
);

// GET /api/v1/courses/:id/stats
router.get('/:id/stats', authenticate, authorize(...TEACHING_ROLES), courseController.getCourseStats);

// ───────────────────────────────────────────────────────
// NESTED: LESSONS
// ───────────────────────────────────────────────────────

// GET /api/v1/courses/:id/lessons
router.get('/:id/lessons', lessonController.getLessonsByCourse);

// POST /api/v1/courses/:id/lessons
router.post(
  '/:id/lessons',
  authenticate,
  authorize(...TEACHING_ROLES),
  lessonValidation,
  validate,
  lessonController.createLesson
);

// ───────────────────────────────────────────────────────
// NESTED: REVIEWS
// ───────────────────────────────────────────────────────

// GET /api/v1/courses/:id/reviews
router.get('/:id/reviews', reviewController.getReviewsByCourse);

// POST /api/v1/courses/:id/reviews
router.post(
  '/:id/reviews',
  authenticate,
  authorize('student'),
  reviewValidation,
  validate,
  reviewController.createReview
);

module.exports = router;
