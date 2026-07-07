// src/modules/rewards/reward.controller.js

const rewardService = require('./reward.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const { toPublicPath } = require('../../middleware/upload');

// POST /api/v1/rewards
const createReward = asyncHandler(async (req, res) => {
  const { title, description, cost, stock } = req.body;

  const reward = await rewardService.createReward({ title, description, cost, stock });

  res.status(201).json(new ApiResponse(201, "Sovg'a yaratildi", { reward }));
});

// GET /api/v1/rewards
const getRewards = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;

  const { rewards, meta } = await rewardService.getRewards({ page, limit });

  res.status(200).json(new ApiResponse(200, "Sovg'alar ro'yxati", { rewards, meta }));
});

// GET /api/v1/rewards/:id
const getRewardById = asyncHandler(async (req, res) => {
  const reward = await rewardService.getRewardById(req.params.id);

  res.status(200).json(new ApiResponse(200, "Sovg'a ma'lumotlari", { reward }));
});

// PATCH /api/v1/rewards/:id
const updateReward = asyncHandler(async (req, res) => {
  const reward = await rewardService.updateReward(req.params.id, req.body);

  res.status(200).json(new ApiResponse(200, "Sovg'a yangilandi", { reward }));
});

// DELETE /api/v1/rewards/:id
const deleteReward = asyncHandler(async (req, res) => {
  await rewardService.deleteReward(req.params.id);

  res.status(200).json(new ApiResponse(200, "Sovg'a o'chirildi"));
});

// POST /api/v1/rewards/:id/image
const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Rasm fayli yuborilishi shart');

  const reward = await rewardService.setImage(req.params.id, toPublicPath(req.file.path));

  res.status(200).json(new ApiResponse(200, 'Rasm yuklandi', { reward }));
});

// POST /api/v1/rewards/:id/redeem
const redeemReward = asyncHandler(async (req, res) => {
  const redemption = await rewardService.redeemReward(req.user.id, req.params.id);

  res.status(201).json(new ApiResponse(201, "Sovg'a so'rovi yuborildi", { redemption }));
});

// GET /api/v1/rewards/redemptions/my
const getMyRedemptions = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;

  const { redemptions, meta } = await rewardService.getMyRedemptions(req.user.id, { page, limit });

  res.status(200).json(new ApiResponse(200, 'Sizning so\'rovlaringiz', { redemptions, meta }));
});

// GET /api/v1/rewards/redemptions — admin
const getAllRedemptions = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;

  const { redemptions, meta } = await rewardService.getAllRedemptions({ page, limit, status });

  res.status(200).json(new ApiResponse(200, "Barcha so'rovlar", { redemptions, meta }));
});

// PATCH /api/v1/rewards/redemptions/:id — admin
const updateRedemptionStatus = asyncHandler(async (req, res) => {
  const { status, adminNote } = req.body;

  const redemption = await rewardService.updateRedemptionStatus(req.params.id, {
    status,
    adminNote,
  });

  res.status(200).json(new ApiResponse(200, "So'rov holati yangilandi", { redemption }));
});

module.exports = {
  createReward,
  getRewards,
  getRewardById,
  updateReward,
  deleteReward,
  uploadImage,
  redeemReward,
  getMyRedemptions,
  getAllRedemptions,
  updateRedemptionStatus,
};
