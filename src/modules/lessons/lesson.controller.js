// src/modules/lessons/lesson.controller.js

const lessonService = require('./lesson.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const { toPublicPath } = require('../../middleware/upload');

// POST /api/v1/courses/:id/lessons
const createLesson = asyncHandler(async (req, res) => {
  const { title, description, content, videoUrl, order } = req.body;

  const lesson = await lessonService.createLesson(req.params.id, req.user.id, req.user.role, {
    title,
    description,
    content,
    videoUrl,
    order,
  });

  res.status(201).json(new ApiResponse(201, "Dars qo'shildi", { lesson }));
});

// GET /api/v1/courses/:id/lessons
const getLessonsByCourse = asyncHandler(async (req, res) => {
  const lessons = await lessonService.getLessonsByCourse(
    req.params.id,
    req.user?.id,
    req.user?.role
  );

  res.status(200).json(new ApiResponse(200, "Darslar ro'yxati", { lessons }));
});

// GET /api/v1/lessons/:id
const getLessonById = asyncHandler(async (req, res) => {
  const lesson = await lessonService.getLessonById(req.params.id, req.user?.id, req.user?.role);

  res.status(200).json(new ApiResponse(200, "Dars ma'lumotlari", { lesson }));
});

// PATCH /api/v1/lessons/:id
const updateLesson = asyncHandler(async (req, res) => {
  const lesson = await lessonService.updateLesson(
    req.params.id,
    req.user.id,
    req.user.role,
    req.body
  );

  res.status(200).json(new ApiResponse(200, 'Dars yangilandi', { lesson }));
});

// DELETE /api/v1/lessons/:id
const deleteLesson = asyncHandler(async (req, res) => {
  await lessonService.deleteLesson(req.params.id, req.user.id, req.user.role);

  res.status(200).json(new ApiResponse(200, "Dars o'chirildi"));
});

// POST /api/v1/lessons/:id/material
const addMaterial = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Fayl yuborilishi shart');

  const lesson = await lessonService.addMaterial(
    req.params.id,
    req.user.id,
    req.user.role,
    toPublicPath(req.file.path)
  );

  res.status(200).json(new ApiResponse(200, 'Material yuklandi', { lesson }));
});

// POST /api/v1/lessons/:id/complete
const completeLesson = asyncHandler(async (req, res) => {
  const { enrollment, alreadyCompleted } = await lessonService.completeLesson(
    req.params.id,
    req.user.id
  );

  const message = alreadyCompleted
    ? 'Bu dars allaqachon tugatilgan'
    : "Dars tugatildi, diamant qo'shildi";

  res.status(200).json(new ApiResponse(200, message, { enrollment, alreadyCompleted }));
});

module.exports = {
  createLesson,
  getLessonsByCourse,
  getLessonById,
  updateLesson,
  deleteLesson,
  addMaterial,
  completeLesson,
};
