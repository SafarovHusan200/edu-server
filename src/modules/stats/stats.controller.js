// src/modules/stats/stats.controller.js

const statsService = require('./stats.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

// GET /api/v1/stats/teacher
const getTeacherStats = asyncHandler(async (req, res) => {
  const stats = await statsService.getTeacherStats(req.user.id);

  res.status(200).json(new ApiResponse(200, 'Umumiy statistika', { stats }));
});

// GET /api/v1/stats/top-teachers
const getTopTeachers = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;

  const { teachers, me, meta } = await statsService.getTopTeachers(
    { page, limit },
    req.user.id,
    req.user.role
  );

  res.status(200).json(new ApiResponse(200, "Eng faol o'qituvchilar", { teachers, me, meta }));
});

// GET /api/v1/stats/admin
const getAdminStats = asyncHandler(async (req, res) => {
  const stats = await statsService.getAdminStats();

  res.status(200).json(new ApiResponse(200, 'Admin dashboard statistikasi', { stats }));
});

// GET /api/v1/stats/student
const getStudentStats = asyncHandler(async (req, res) => {
  const stats = await statsService.getStudentStats(req.user.id);

  res.status(200).json(new ApiResponse(200, "O'quvchi dashboard statistikasi", { stats }));
});

module.exports = { getTeacherStats, getTopTeachers, getAdminStats, getStudentStats };
