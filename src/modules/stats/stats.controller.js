// src/modules/stats/stats.controller.js

const statsService = require('./stats.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

// GET /api/v1/stats/teacher
const getTeacherStats = asyncHandler(async (req, res) => {
  const stats = await statsService.getTeacherStats(req.user.id);

  res.status(200).json(new ApiResponse(200, 'Umumiy statistika', { stats }));
});

module.exports = { getTeacherStats };
