const User = require('../users/user.model');
const ApiError = require('../../utils/ApiError');
const Otp = require('./otp.model');
const notificationService = require('../notifications/notification.service');

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

  // 4. Oxirgi kirish vaqtini yangilash (premium muddati tugagan bo'lsa shu bilan birga saqlanadi)
  user.lastLogin = new Date();
  user.downgradeIfPremiumExpired();
  await user.save();

  // 5. JWT Token yaratish
  const token = user.generateJwtToken();

  return { user, token };
};

// ─────────────────────────────────────────
// REGISTER (phone + password)
// isVerified=false bilan yaratiladi — admin/superadmin tasdiqlamaguncha login qila olmaydi
// ─────────────────────────────────────────
const register = async ({ name, phone, password, role, grade }) => {
  const existingUser = await User.findOne({ phone });
  if (existingUser) {
    throw new ApiError(400, "Bu telefon raqam allaqachon ro'yxatdan o'tgan");
  }

  const user = await User.create({ name, phone, password, role, grade });

  const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('_id');
  await Promise.all(
    admins.map((admin) =>
      notificationService.createNotification({
        userId: admin._id,
        type: 'system',
        title: "Yangi foydalanuvchi tasdiqlashni kutmoqda",
        message: `${name} (${phone}, ${role}) ro'yxatdan o'tdi va tasdiqlanishini kutmoqda`,
        meta: { userId: user._id },
      })
    )
  );

  return { user };
};

// ─────────────────────────────────────────
// LOGIN (phone + password)
// ─────────────────────────────────────────
const login = async ({ phone, password }) => {
  const user = await User.findOne({ phone });

  if (!user) {
    throw new ApiError(
      401,
      "Telefon raqam yoki parol noto'g'ri, Telegram bot orqali kirishga harakat qilib ko'ring unda"
    );
  }

  if (user.isBlocked) {
    throw new ApiError(403, 'Sizning hisobingiz bloklangan');
  }

  if (!user.isVerified) {
    throw new ApiError(403, 'Hisobingiz hali administrator tomonidan tasdiqlanmagan');
  }

  // Premium muddati tugagan bo'lsa — pastdagi user.save() bilan birga saqlanadi
  user.downgradeIfPremiumExpired();

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

// ─────────────────────────────────────────
// LOGOUT — tokenVersion oshiriladi, shu userga tegishli barcha eski
// tokenlar (joriy tokendan tashqari boshqa qurilmalardagilar ham) darhol yaroqsiz bo'ladi
// ─────────────────────────────────────────
const logout = async (userId) => {
  await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
};

module.exports = {
  register,
  login,
  telegramAuth,
  getMe,
  logout,
  verifyTelegramOtp,
};
