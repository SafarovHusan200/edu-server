// src/modules/live-quiz/liveQuiz.controller.js

const liveQuizService = require('./liveQuiz.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const { toPublicPath } = require('../../middleware/upload');

// POST /api/v1/live-quizzes
const createQuiz = asyncHandler(async (req, res) => {
  const quiz = await liveQuizService.createQuiz(req.user, req.body);
  res.status(201).json(new ApiResponse(201, 'Viktorina yaratildi', { quiz }));
});

// GET /api/v1/live-quizzes
const getMyQuizzes = asyncHandler(async (req, res) => {
  const { page, limit, search, all } = req.query;
  const { quizzes, meta } = await liveQuizService.getMyQuizzes(req.user, { page, limit, search, all });
  res.status(200).json(new ApiResponse(200, 'Viktorinalar', { quizzes, meta }));
});

// GET /api/v1/live-quizzes/:id
const getQuizById = asyncHandler(async (req, res) => {
  const quiz = await liveQuizService.getQuizById(req.params.id, req.user);
  res.status(200).json(new ApiResponse(200, 'Viktorina', { quiz }));
});

// PATCH /api/v1/live-quizzes/:id
const updateQuiz = asyncHandler(async (req, res) => {
  const quiz = await liveQuizService.updateQuiz(req.params.id, req.user, req.body);
  res.status(200).json(new ApiResponse(200, 'Viktorina yangilandi', { quiz }));
});

// DELETE /api/v1/live-quizzes/:id
const deleteQuiz = asyncHandler(async (req, res) => {
  await liveQuizService.deleteQuiz(req.params.id, req.user);
  res.status(200).json(new ApiResponse(200, "Viktorina o'chirildi"));
});

// POST /api/v1/live-quizzes/import/:quizId
const importFromQuiz = asyncHandler(async (req, res) => {
  const result = await liveQuizService.importFromQuiz(req.params.quizId, req.user, req.body);
  res.status(201).json(
    new ApiResponse(201, `${result.imported} ta savol import qilindi`, result)
  );
});

// POST /api/v1/live-quizzes/upload-image
const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Rasm fayli yuborilishi shart');
  res.status(201).json(new ApiResponse(201, 'Rasm yuklandi', { image: toPublicPath(req.file.path) }));
});

// POST /api/v1/live-quizzes/:id/sessions
const startSession = asyncHandler(async (req, res) => {
  const session = await liveQuizService.startSession(req.params.id, req.user, req.body);
  res.status(201).json(new ApiResponse(201, "Jonli o'yin yaratildi", { session }));
});

// GET /api/v1/live-quizzes/:id/results
const getQuizResults = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { sessions, meta } = await liveQuizService.getQuizResults(req.params.id, req.user, { page, limit });
  res.status(200).json(new ApiResponse(200, "O'tkazilgan o'yinlar", { sessions, meta }));
});

// GET /api/v1/live-quizzes/results/:sessionId
const getSessionResult = asyncHandler(async (req, res) => {
  const session = await liveQuizService.getSessionResult(req.params.sessionId, req.user);
  res.status(200).json(new ApiResponse(200, "O'yin natijasi", { session }));
});

// GET /api/v1/live-quizzes/join/:pin — public
const getSessionByPin = asyncHandler(async (req, res) => {
  const session = liveQuizService.getSessionByPin(req.params.pin);
  res.status(200).json(new ApiResponse(200, "O'yin topildi", { session }));
});

module.exports = {
  createQuiz,
  getMyQuizzes,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  importFromQuiz,
  uploadImage,
  startSession,
  getQuizResults,
  getSessionResult,
  getSessionByPin,
};
