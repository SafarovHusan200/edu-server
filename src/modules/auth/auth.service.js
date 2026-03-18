const User = require('../users/user.model');
const ApiError = require('../../utils/ApiError');

// ─────────────────────────────────────────
// REGISTER (email + password)
// ─────────────────────────────────────────
const register = async ({ name, email, password, phone, role }) => {
  // 1. Email band emasligini tekshirish
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(400, "Bu email allaqachon ro'yhatdan o'tgan");
  }

  // 2. Userni yaratish (password pre('save') da hash bo'ladi)
  const user = await User.create({ name, email, password, phone, role });

  // 3. Token generatsiya
  const token = user.generateJwtToken();

  return { user, token };
};

// ─────────────────────────────────────────
// LOGIN (email + password)
// ─────────────────────────────────────────
const login = async ({ email, password }) => {
  // 1. Userni topish
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new ApiError(401, "Email yoki parol noto'g'ri");
  }

  // 2. Bloklangan foydalanuvchini tekshirish
  if (user.isBlocked) {
    throw new ApiError(403, 'Sizning hisobingiz bloklangan');
  }

  // 3. Parolni tekshirish
  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    throw new ApiError(401, "Email yoki parol noto'g'ri");
  }

  // 4. lastLogin yangilash
  user.lastLogin = new Date();
  await user.save();

  const token = user.generateJwtToken();

  return { user, token };
};

// ─────────────────────────────────────────
// TELEGRAM AUTH (register yoki login)
// ─────────────────────────────────────────
const telegramAuth = async ({ telegramId, name, phone, telegramUsername, avatar }) => {
  // 1. Telegram ID bo'yicha userni qidirish
  let user = await User.findOne({ telegramId });

  if (user) {
    // — Mavjud user: ma'lumotlarini yangilash
    if (user.isBlocked) {
      throw new ApiError(403, 'Sizning hisobingiz bloklangan');
    }

    user.name = name ?? user.name;
    user.phone = phone ?? user.phone; // ← qo'shildi
    user.telegramUsername = telegramUsername ?? user.telegramUsername;
    user.avatar = avatar ?? user.avatar;
    user.lastLogin = new Date();

    await user.save();
  } else {
    // — Yangi user: ro'yxatdan o'tkazish
    user = await User.create({
      name,
      phone, // ← qo'shildi
      telegramId,
      telegramUsername,
      avatar,
      isVerified: true,
      lastLogin: new Date(),
    });
  }

  const token = user.generateJwtToken();

  return { user, token };
};

// ─────────────────────────────────────────
// GET ME (token orqali)
// ─────────────────────────────────────────
const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'Foydalanuvchi topilmadi');
  }
  return user;
};

module.exports = {
  register,
  login,
  telegramAuth,
  getMe,
};
