const authService = require('./auth.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

// ─────────────────────────────────────────
// POST /api/v1/auth/register
// ─────────────────────────────────────────
const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role } = req.body;

  const { user, token } = await authService.register({
    name,
    email,
    password,
    phone,
    role,
  });

  res
    .status(201)
    .json(new ApiResponse(201, "Ro'yxatdan muvaffaqiyatli o'tdingiz", { user, token }));
});

// ─────────────────────────────────────────
// POST /api/v1/auth/login
// ─────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { user, token } = await authService.login({ email, password });

  res.status(200).json(new ApiResponse(200, 'Tizimga muvaffaqiyatli kirdingiz', { user, token }));
});

// ─────────────────────────────────────────
// POST /api/v1/auth/telegram
// ─────────────────────────────────────────
const telegramAuth = asyncHandler(async (req, res) => {
  const { telegramId, name, telegramUsername, avatar } = req.body;

  const { user, token } = await authService.telegramAuth({
    telegramId,
    name,
    telegramUsername,
    avatar,
  });

  res
    .status(200)
    .json(new ApiResponse(200, 'Telegram orqali muvaffaqiyatli kirdingiz', { user, token }));
});

// ─────────────────────────────────────────
// GET /api/v1/auth/me
// ─────────────────────────────────────────
const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user.id);

  res.status(200).json(new ApiResponse(200, "Profil ma'lumotlari", { user }));
});

module.exports = {
  register,
  login,
  telegramAuth,
  getMe,
};
