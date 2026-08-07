// src/modules/users/user.controller.js

const userService = require('./user.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const { toPublicPath } = require('../../middleware/upload');

// PATCH /api/v1/users/me
const updateMe = asyncHandler(async (req, res) => {
  const { name, grade } = req.body;

  const user = await userService.updateMe(req.user.id, { name, grade });

  res.status(200).json(new ApiResponse(200, 'Profil yangilandi', { user }));
});

// PATCH /api/v1/users/me/password
const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const { token } = await userService.changePassword(req.user.id, { oldPassword, newPassword });

  res
    .status(200)
    .json(new ApiResponse(200, "Parol muvaffaqiyatli o'zgartirildi. Boshqa qurilmalardagi sessiyalar tugatildi", { token }));
});

// POST /api/v1/users/me/avatar
const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Rasm fayli yuborilishi shart');

  const user = await userService.setAvatar(req.user.id, toPublicPath(req.file.path));

  res.status(200).json(new ApiResponse(200, 'Avatar yuklandi', { user }));
});

// GET /api/v1/users — admin
const getUsers = asyncHandler(async (req, res) => {
  const { page, limit, role, search } = req.query;

  const { users, meta } = await userService.getUsers({ page, limit, role, search });

  res.status(200).json(new ApiResponse(200, "Foydalanuvchilar ro'yxati", { users, meta }));
});

// GET /api/v1/users/:id — admin
const getUserById = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);

  res.status(200).json(new ApiResponse(200, "Foydalanuvchi ma'lumotlari", { user }));
});

// PATCH /api/v1/users/:id/block — admin
const setBlocked = asyncHandler(async (req, res) => {
  const { isBlocked } = req.body;

  const user = await userService.setBlocked(req.params.id, Boolean(isBlocked));

  res
    .status(200)
    .json(new ApiResponse(200, isBlocked ? 'Foydalanuvchi bloklandi' : 'Blok olib tashlandi', { user }));
});

// PATCH /api/v1/users/:id — superadmin
const updateUser = asyncHandler(async (req, res) => {
  const { name, phone, role, tarif, grade } = req.body;

  const user = await userService.updateUser(req.params.id, { name, phone, role, tarif, grade });

  res.status(200).json(new ApiResponse(200, 'Foydalanuvchi yangilandi', { user }));
});

// DELETE /api/v1/users/:id — superadmin
const deleteUser = asyncHandler(async (req, res) => {
  await userService.deleteUser(req.params.id, req.user.id);

  res.status(200).json(new ApiResponse(200, "Foydalanuvchi o'chirildi"));
});

// POST /api/v1/users/me/telegram/link
const linkTelegram = asyncHandler(async (req, res) => {
  const { token, deepLink, expiresAt } = await userService.createTelegramLinkToken(req.user.id);

  res
    .status(200)
    .json(new ApiResponse(200, "Telegramni ulash uchun havola tayyor", { token, deepLink, expiresAt }));
});

// DELETE /api/v1/users/me/telegram
const unlinkTelegram = asyncHandler(async (req, res) => {
  const user = await userService.unlinkTelegram(req.user.id);

  res.status(200).json(new ApiResponse(200, 'Telegram uzildi', { user }));
});

// GET /api/v1/users/leaderboard
const getLeaderboard = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;

  const { leaderboard, meta } = await userService.getLeaderboard({ page, limit });

  res.status(200).json(new ApiResponse(200, 'Reyting', { leaderboard, meta }));
});

module.exports = {
  updateMe,
  changePassword,
  uploadAvatar,
  getUsers,
  getUserById,
  setBlocked,
  updateUser,
  deleteUser,
  linkTelegram,
  unlinkTelegram,
  getLeaderboard,
};
