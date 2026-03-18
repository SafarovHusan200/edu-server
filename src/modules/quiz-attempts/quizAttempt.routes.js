// src/modules/quiz-attempts/quizAttempt.routes.js

const express = require('express');
const router = express.Router();

const attemptController = require('./quizAttempt.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { submitValidation } = require('../quizzes/quiz.validation');

// ─────────────────────────────────────────
// POST /api/v1/attempts/:quizId/start
// Student quizni boshlaydi
// ─────────────────────────────────────────
router.post('/:quizId/start', authenticate, authorize('student'), attemptController.startAttempt);

// ─────────────────────────────────────────
// POST /api/v1/attempts/:attemptId/submit
// Student javoblarini yuboradi
// ─────────────────────────────────────────
router.post(
  '/:attemptId/submit',
  authenticate,
  authorize('student'),
  submitValidation,
  validate,
  attemptController.submitAttempt
);

// ─────────────────────────────────────────
// GET /api/v1/attempts/:attemptId
// Attempt ko'rish (student o'zi yoki teacher)
// ─────────────────────────────────────────
router.get('/:attemptId', authenticate, attemptController.getAttemptById);

// ─────────────────────────────────────────
// GET /api/v1/attempts/quiz/:quizId/my
// Student o'z natijalarini ko'radi
// ─────────────────────────────────────────
router.get('/quiz/:quizId/my', authenticate, authorize('student'), attemptController.getMyAttempts);

// ─────────────────────────────────────────
// GET /api/v1/attempts/quiz/:quizId/results
// Teacher/admin barcha natijalarni ko'radi
// ─────────────────────────────────────────
router.get(
  '/quiz/:quizId/results',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  attemptController.getQuizResults
);

// ─────────────────────────────────────────
// PATCH /api/v1/attempts/:attemptId/review
// Teacher open-ended javoblarni baholaydi
// ─────────────────────────────────────────
router.patch(
  '/:attemptId/review',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  attemptController.reviewOpenEnded
);

module.exports = router;
