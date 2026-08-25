// src/modules/daily-spin/dailySpin.controller.js

const dailySpinService = require('./dailySpin.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

// GET /api/v1/daily-spin/status
const getStatus = asyncHandler(async (req, res) => {
  const status = await dailySpinService.getStatus(req.user.id);

  res.status(200).json(new ApiResponse(200, 'Kunlik barabon holati', status));
});

// POST /api/v1/daily-spin/spin
const spin = asyncHandler(async (req, res) => {
  const result = await dailySpinService.spin(req.user.id);

  res.status(200).json(new ApiResponse(200, 'Barabon aylantirildi', result));
});

module.exports = { getStatus, spin };
