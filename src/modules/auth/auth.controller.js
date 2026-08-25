const authService = require('./auth.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

// ─────────────────────────────────────────
// POST /api/v1/auth/register
// ─────────────────────────────────────────
const register = asyncHandler(async (req, res) => {
  const { name, phone, password, role, grade } = req.body;

  const { user } = await authService.register({
    name,
    phone,
    password,
    role,
    grade,
  });

  res
    .status(201)
    .json(
      new ApiResponse(
        201,
        "Ro'yxatdan o'tdingiz. Hisobingiz administrator tomonidan tasdiqlangach tizimga kira olasiz",
        { user }
      )
    );
});

// ─────────────────────────────────────────
// POST /api/v1/auth/login
// ─────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const { phone, password } = req.body;

  const { user, token } = await authService.login({ phone, password });

  res.status(200).json(new ApiResponse(200, 'Tizimga muvaffaqiyatli kirdingiz', { user, token }));
});

// ─────────────────────────────────────────
// GET /api/v1/auth/me
// ─────────────────────────────────────────
const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user.id);

  res.status(200).json(new ApiResponse(200, "Profil ma'lumotlari", { user }));
});

const verifyTelegramOtp = asyncHandler(async (req, res) => {
  const { telegramId, code } = req.body;

  // Servisni chaqiramiz
  const { user, token } = await authService.verifyTelegramOtp({
    telegramId,
    code,
  });

  res.status(200).json(new ApiResponse(200, 'Muvaffaqiyatli kirdingiz', { user, token }));
});

// ─────────────────────────────────────────
// POST /api/v1/auth/logout
// ─────────────────────────────────────────
const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user.id);

  res.status(200).json(new ApiResponse(200, 'Tizimdan chiqdingiz'));
});

module.exports = {
  register,
  login,
  getMe,
  logout,
  verifyTelegramOtp, // ← qo'shildi
};
