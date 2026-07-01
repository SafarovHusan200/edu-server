const User = require('../users/user.model');
const ApiError = require('../../utils/ApiError');
const Otp = require('./otp.model');

// ─────────────────────────────────────────
// TELEGRAM OTP VERIFY (To'g'rilangan variant)
// ─────────────────────────────────────────
const verifyTelegramOtp = async ({ code }) => {
  // 1. OTP kodni bazadan qidirish
  // Bir vaqtning o'zida isUsed va expiresAt ni ham tekshiramiz
  const otp = await Otp.findOne({
    code,
    isUsed: false,
    expiresAt: { $gt: new Date() },
  });

  if (!otp) {
    throw new ApiError(400, "Kod noto'g'ri yoki muddati tugagan");
  }

  // 2. Foydalanuvchini topish (telegramId ni otp modelidan olamiz)
  const user = await User.findOne({ telegramId: otp.telegramId });

  if (!user) {
    throw new ApiError(404, "Foydalanuvchi topilmadi. Avval botdan ro'yxatdan o'ting");
  }

  if (user.isBlocked) {
    throw new ApiError(403, 'Hisobingiz bloklangan');
  }

  // 3. Kodni ishlatilgan deb belgilash
  otp.isUsed = true;
  await otp.save();

  // 4. Oxirgi kirish vaqtini yangilash
  user.lastLogin = new Date();
  await user.save();

  // 5. JWT Token yaratish
  const token = user.generateJwtToken();

  return { user, token };
};

// ─────────────────────────────────────────
// REGISTER (phone + password)
// ─────────────────────────────────────────
const register = async ({ name, phone, password, role, grade }) => {
  const existingUser = await User.findOne({ phone });
  if (existingUser) {
    throw new ApiError(400, "Bu telefon raqam allaqachon ro'yxatdan o'tgan");
  }

  const user = await User.create({ name, phone, password, role, grade });
  const token = user.generateJwtToken();
  return { user, token };
};

// ─────────────────────────────────────────
// LOGIN (phone + password)
// ─────────────────────────────────────────
const login = async ({ phone, password }) => {
  const user = await User.findOne({ phone });

  console.log(user);

  if (!user) {
    throw new ApiError(
      401,
      "Telefon raqam yoki parol noto'g'ri, Telegram bot orqali kirishga harakat qilib ko'ring unda"
    );
  }

  if (user.isBlocked) {
    throw new ApiError(403, 'Sizning hisobingiz bloklangan');
  }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    throw new ApiError(
      401,
      "Telefon raqam yoki parol noto'g'ri, telegram orqali kirish tavsiya etiladi"
    );
  }

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
  verifyTelegramOtp,
};
