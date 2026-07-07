// src/modules/courses/course.controller.js

const courseService = require('./course.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const { toPublicPath } = require('../../middleware/upload');

// POST /api/v1/courses
const createCourse = asyncHandler(async (req, res) => {
  const { title, description, category, price } = req.body;

  const course = await courseService.createCourse({
    title,
    description,
    category,
    price,
    teacherId: req.user.id,
  });

  res.status(201).json(new ApiResponse(201, 'Kurs yaratildi', { course }));
});

// GET /api/v1/courses
const getCourses = asyncHandler(async (req, res) => {
  const { page, limit, category, teacher, search } = req.query;

  const { courses, meta } = await courseService.getCourses({
    page,
    limit,
    category,
    teacher,
    search,
  });

  res.status(200).json(new ApiResponse(200, "Kurslar ro'yxati", { courses, meta }));
});

// GET /api/v1/courses/:id
const getCourseById = asyncHandler(async (req, res) => {
  const { course, lessons, hasAccess } = await courseService.getCourseById(
    req.params.id,
    req.user?.id,
    req.user?.role
  );

  res.status(200).json(new ApiResponse(200, "Kurs ma'lumotlari", { course, lessons, hasAccess }));
});

// PATCH /api/v1/courses/:id
const updateCourse = asyncHandler(async (req, res) => {
  const course = await courseService.updateCourse(
    req.params.id,
    req.user.id,
    req.user.role,
    req.body
  );

  res.status(200).json(new ApiResponse(200, 'Kurs yangilandi', { course }));
});

// DELETE /api/v1/courses/:id
const deleteCourse = asyncHandler(async (req, res) => {
  await courseService.deleteCourse(req.params.id, req.user.id, req.user.role);

  res.status(200).json(new ApiResponse(200, "Kurs o'chirildi"));
});

// POST /api/v1/courses/:id/thumbnail
const uploadThumbnail = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Rasm fayli yuborilishi shart');

  const course = await courseService.setThumbnail(
    req.params.id,
    req.user.id,
    req.user.role,
    toPublicPath(req.file.path)
  );

  res.status(200).json(new ApiResponse(200, 'Muqova yuklandi', { course }));
});

// GET /api/v1/courses/:id/stats
const getCourseStats = asyncHandler(async (req, res) => {
  const stats = await courseService.getCourseStats(req.params.id, req.user.id, req.user.role);

  res.status(200).json(new ApiResponse(200, 'Kurs statistikasi', { stats }));
});

module.exports = {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  uploadThumbnail,
  getCourseStats,
};
