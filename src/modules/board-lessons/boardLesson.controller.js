// src/modules/board-lessons/boardLesson.controller.js

const boardLessonService = require('./boardLesson.service');
const { generateLessonDraft } = require('./boardLesson.ai');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const { toPublicPath } = require('../../middleware/upload');

// POST /api/v1/board-lessons
const createLesson = asyncHandler(async (req, res) => {
  const lesson = await boardLessonService.createLesson(req.user, req.body);
  res.status(201).json(new ApiResponse(201, 'Dars yaratildi', { lesson }));
});

// GET /api/v1/board-lessons
const getLessons = asyncHandler(async (req, res) => {
  const { page, limit, search, grade, all } = req.query;
  const { lessons, meta } = await boardLessonService.getLessons(req.user, { page, limit, search, grade, all });
  res.status(200).json(new ApiResponse(200, 'Interaktiv darslar', { lessons, meta }));
});

// GET /api/v1/board-lessons/:id
const getLessonById = asyncHandler(async (req, res) => {
  const lesson = await boardLessonService.getLessonById(req.params.id, req.user);
  res.status(200).json(new ApiResponse(200, 'Interaktiv dars', { lesson }));
});

// PATCH /api/v1/board-lessons/:id
const updateLesson = asyncHandler(async (req, res) => {
  const lesson = await boardLessonService.updateLesson(req.params.id, req.user, req.body);
  res.status(200).json(new ApiResponse(200, 'Dars yangilandi', { lesson }));
});

// DELETE /api/v1/board-lessons/:id
const deleteLesson = asyncHandler(async (req, res) => {
  await boardLessonService.deleteLesson(req.params.id, req.user);
  res.status(200).json(new ApiResponse(200, "Dars o'chirildi"));
});

// POST /api/v1/board-lessons/:id/duplicate
const duplicateLesson = asyncHandler(async (req, res) => {
  const lesson = await boardLessonService.duplicateLesson(req.params.id, req.user);
  res.status(201).json(new ApiResponse(201, 'Dars nusxalandi', { lesson }));
});

// POST /api/v1/board-lessons/generate — AI qoralama (bazaga saqlanmaydi)
const generateDraft = asyncHandler(async (req, res) => {
  const { topic, grade, subject, slideCount, exerciseCount, notes } = req.body;
  const draft = await generateLessonDraft({ topic, grade, subject, slideCount, exerciseCount, notes });
  res.status(200).json(new ApiResponse(200, 'Dars qoralamasi tayyor', { draft }));
});

// POST /api/v1/board-lessons/upload-image
const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Rasm fayli yuborilishi shart');
  res.status(201).json(new ApiResponse(201, 'Rasm yuklandi', { image: toPublicPath(req.file.path) }));
});

module.exports = {
  createLesson,
  getLessons,
  getLessonById,
  updateLesson,
  deleteLesson,
  duplicateLesson,
  generateDraft,
  uploadImage,
};
