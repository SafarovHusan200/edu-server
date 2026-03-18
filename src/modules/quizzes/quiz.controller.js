// src/modules/quizzes/quiz.controller.js

const quizService = require('./quiz.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

// ─────────────────────────────────────────
// POST /api/v1/quizzes
// ─────────────────────────────────────────
const createQuiz = asyncHandler(async (req, res) => {
  const { title, description, targetType, targetId, passingScore, maxAttempts, timeLimit } =
    req.body;

  const quiz = await quizService.createQuiz({
    title,
    description,
    targetType,
    targetId,
    passingScore,
    maxAttempts,
    timeLimit,
    createdBy: req.user.id,
  });

  res.status(201).json(new ApiResponse(201, 'Quiz muvaffaqiyatli yaratildi', { quiz }));
});

// ─────────────────────────────────────────
// GET /api/v1/quizzes
// ─────────────────────────────────────────
const getQuizzes = asyncHandler(async (req, res) => {
  const { targetType, targetId } = req.query;

  const quizzes = await quizService.getQuizzes({ targetType, targetId });

  res.status(200).json(new ApiResponse(200, "Quizlar ro'yxati", { quizzes }));
});

// ─────────────────────────────────────────
// GET /api/v1/quizzes/:id  (student)
// ─────────────────────────────────────────
const getQuizById = asyncHandler(async (req, res) => {
  const { quiz, questions } = await quizService.getQuizById(req.params.id);

  res.status(200).json(new ApiResponse(200, "Quiz ma'lumotlari", { quiz, questions }));
});

// ─────────────────────────────────────────
// GET /api/v1/quizzes/:id/answers  (teacher/admin)
// ─────────────────────────────────────────
const getQuizByIdWithAnswers = asyncHandler(async (req, res) => {
  const { quiz, questions } = await quizService.getQuizByIdWithAnswers(req.params.id);

  res.status(200).json(new ApiResponse(200, "Quiz to'liq ma'lumotlari", { quiz, questions }));
});

// ─────────────────────────────────────────
// PATCH /api/v1/quizzes/:id
// ─────────────────────────────────────────
const updateQuiz = asyncHandler(async (req, res) => {
  const quiz = await quizService.updateQuiz(req.params.id, req.user.id, req.body);

  res.status(200).json(new ApiResponse(200, 'Quiz yangilandi', { quiz }));
});

// ─────────────────────────────────────────
// DELETE /api/v1/quizzes/:id
// ─────────────────────────────────────────
const deleteQuiz = asyncHandler(async (req, res) => {
  await quizService.deleteQuiz(req.params.id, req.user.id, req.user.role);

  res.status(200).json(new ApiResponse(200, "Quiz o'chirildi"));
});

// ─────────────────────────────────────────
// POST /api/v1/quizzes/:id/questions
// ─────────────────────────────────────────
const addQuestion = asyncHandler(async (req, res) => {
  const { text, type, options, correctAnswer, sampleAnswer, points, order } = req.body;

  const question = await quizService.addQuestion(req.params.id, req.user.id, {
    text,
    type,
    options,
    correctAnswer,
    sampleAnswer,
    points,
    order,
  });

  res.status(201).json(new ApiResponse(201, "Savol qo'shildi", { question }));
});

// ─────────────────────────────────────────
// PATCH /api/v1/quizzes/questions/:questionId
// ─────────────────────────────────────────
const updateQuestion = asyncHandler(async (req, res) => {
  const question = await quizService.updateQuestion(req.params.questionId, req.user.id, req.body);

  res.status(200).json(new ApiResponse(200, 'Savol yangilandi', { question }));
});

// ─────────────────────────────────────────
// DELETE /api/v1/quizzes/questions/:questionId
// ─────────────────────────────────────────
const deleteQuestion = asyncHandler(async (req, res) => {
  await quizService.deleteQuestion(req.params.questionId, req.user.id);

  res.status(200).json(new ApiResponse(200, "Savol o'chirildi"));
});

module.exports = {
  createQuiz,
  getQuizzes,
  getQuizById,
  getQuizByIdWithAnswers,
  updateQuiz,
  deleteQuiz,
  addQuestion,
  updateQuestion,
  deleteQuestion,
};
