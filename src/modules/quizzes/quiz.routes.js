// src/modules/quizzes/quiz.routes.js

const express = require('express');
const router = express.Router();

const quizController = require('./quiz.controller');
const attemptController = require('../quiz-attempts/quizAttempt.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { quizValidation, questionValidation, submitValidation } = require('./quiz.validation');
const validate = require('../../middleware/validate');

// ───────────────────────────────────────────────────────
// QUIZ CRUD
// ───────────────────────────────────────────────────────

// Barcha quizlar (public)
router.get('/', quizController.getQuizzes);

// Quiz — student (javoblarsiz)
router.get('/:id', quizController.getQuizById);

// Quiz — teacher/admin (javoblar bilan)
router.get(
  '/:id/answers',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  quizController.getQuizByIdWithAnswers
);

// Quiz yaratish
router.post(
  '/',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  quizValidation,
  validate,
  quizController.createQuiz
);

// Quiz yangilash
router.patch(
  '/:id',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  quizController.updateQuiz
);

// Quiz o'chirish
router.delete(
  '/:id',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  quizController.deleteQuiz
);

// ───────────────────────────────────────────────────────
// QUESTIONS
// ───────────────────────────────────────────────────────

router.post(
  '/:id/questions',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  questionValidation,
  validate,
  quizController.addQuestion
);

router.patch(
  '/questions/:questionId',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  quizController.updateQuestion
);

router.delete(
  '/questions/:questionId',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  quizController.deleteQuestion
);

// ───────────────────────────────────────────────────────
// ATTEMPTS
// ───────────────────────────────────────────────────────

// Boshlash
router.post('/:quizId/start', authenticate, authorize('student'), attemptController.startAttempt);

// Yuborish
router.post(
  '/attempts/:attemptId/submit',
  authenticate,
  authorize('student'),
  submitValidation,
  validate,
  attemptController.submitAttempt
);

// O'z natijalari
router.get('/:quizId/my-attempts', authenticate, attemptController.getMyAttempts);

// Barcha natijalar (teacher/admin)
router.get(
  '/:quizId/results',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  attemptController.getQuizResults
);

// Open ended tekshirish (teacher)
router.patch(
  '/attempts/:attemptId/review',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  attemptController.reviewOpenEnded
);

module.exports = router;
