// src/modules/quizzes/quizShare.controller.js

const quizShareService = require('./quizShare.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

// POST /api/v1/quizzes/:id/share
const shareQuiz = asyncHandler(async (req, res) => {
  const { toTeacherPhone } = req.body;

  const share = await quizShareService.shareQuiz(req.params.id, req.user.id, toTeacherPhone);

  res.status(201).json(new ApiResponse(201, 'Test ulashildi', { share }));
});

// GET /api/v1/quizzes/shares/incoming
const getIncomingShares = asyncHandler(async (req, res) => {
  const { status } = req.query;

  const shares = await quizShareService.getIncomingShares(req.user.id, { status });

  res.status(200).json(new ApiResponse(200, 'Sizga ulashilgan testlar', { shares }));
});

// GET /api/v1/quizzes/shares/outgoing
const getOutgoingShares = asyncHandler(async (req, res) => {
  const { status } = req.query;

  const shares = await quizShareService.getOutgoingShares(req.user.id, { status });

  res.status(200).json(new ApiResponse(200, 'Siz ulashgan testlar', { shares }));
});

// PATCH /api/v1/quizzes/shares/:id/accept
const acceptShare = asyncHandler(async (req, res) => {
  const { share, clonedQuiz } = await quizShareService.acceptShare(req.params.id, req.user.id);

  res.status(200).json(new ApiResponse(200, 'Test qabul qilindi, mustaqil nusxa yaratildi', { share, clonedQuiz }));
});

// PATCH /api/v1/quizzes/shares/:id/reject
const rejectShare = asyncHandler(async (req, res) => {
  const share = await quizShareService.rejectShare(req.params.id, req.user.id);

  res.status(200).json(new ApiResponse(200, 'Test rad etildi', { share }));
});

module.exports = {
  shareQuiz,
  getIncomingShares,
  getOutgoingShares,
  acceptShare,
  rejectShare,
};
