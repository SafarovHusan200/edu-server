// src/modules/quiz-attempts/quizAttempt.controller.js

const quizAttemptService = require('./quizAttempt.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

// ─────────────────────────────────────────
// POST /api/v1/quiz-attempts/:quizId/start
// ─────────────────────────────────────────
const startAttempt = asyncHandler(async (req, res) => {
  const attempt = await quizAttemptService.startAttempt(req.params.quizId, req.user.id);

  res.status(201).json(new ApiResponse(201, 'Quiz boshlandi', { attempt }));
});

// ─────────────────────────────────────────
// POST /api/v1/quiz-attempts/:attemptId/submit
// ─────────────────────────────────────────
const submitAttempt = asyncHandler(async (req, res) => {
  const { answers } = req.body;

  const attempt = await quizAttemptService.submitAttempt(
    req.params.attemptId,
    req.user.id,
    answers
  );

  res.status(200).json(new ApiResponse(200, 'Quiz yakunlandi', { attempt }));
});

// ─────────────────────────────────────────
// GET /api/v1/quiz-attempts/:quizId/my
// ─────────────────────────────────────────
const getMyAttempts = asyncHandler(async (req, res) => {
  const data = await quizAttemptService.getMyAttempts(req.params.quizId, req.user.id);

  res.status(200).json(new ApiResponse(200, 'Sizning natijalaringiz', data));
});

// ─────────────────────────────────────────
// GET /api/v1/quiz-attempts/:quizId/results  (teacher/admin)
// ─────────────────────────────────────────
const getQuizResults = asyncHandler(async (req, res) => {
  const attempts = await quizAttemptService.getQuizResults(req.params.quizId);

  res.status(200).json(new ApiResponse(200, 'Barcha natijalar', { attempts }));
});

// ─────────────────────────────────────────
// PATCH /api/v1/quiz-attempts/:attemptId/review  (teacher)
// ─────────────────────────────────────────
const reviewOpenEnded = asyncHandler(async (req, res) => {
  const { reviewedAnswers } = req.body;

  const attempt = await quizAttemptService.reviewOpenEnded(
    req.params.attemptId,
    req.user.id,
    reviewedAnswers
  );

  res.status(200).json(new ApiResponse(200, 'Javoblar baholandi', { attempt }));
});

const getAttemptById = asyncHandler(async (req, res) => {
  const attempt = await quizAttemptService.getAttemptById(
    req.params.attemptId,
    req.user.id,
    req.user.role
  );

  res.status(200).json(new ApiResponse(200, "Attempt ma'lumotlari", { attempt }));
});

module.exports = {
  startAttempt,
  submitAttempt,
  getMyAttempts,
  getQuizResults,
  reviewOpenEnded,
  getAttemptById,
};
