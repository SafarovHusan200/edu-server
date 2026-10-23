const crypto = require('crypto');
const User = require('../users/user.model');
const ApiError = require('../../utils/ApiError');
const Otp = require('./otp.model');
const notificationService = require('../notifications/notification.service');
const { frontendLinks } = require('../../config/frontendLinks');

// Sizib chiqgan/eski initData qayta ishlatilmasligi uchun maksimal yashash muddati
const INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;

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
// TELEGRAM MINI APP (WebApp) LOGIN
// initData'ni Telegramning o'z algoritmi bo'yicha tasdiqlaymiz:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// Yangi hisob yaratilmaydi — foydalanuvchi avval botdan (/start) ro'yxatdan
// o'tgan bo'lishi shart (telegramId orqali qidiriladi).
// ─────────────────────────────────────────
const verifyTelegramWebApp = async ({ initData }) => {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) {
    throw new ApiError(400, "initData noto'g'ri formatda");
  }
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(process.env.TELEGRAM_BOT_TOKEN)
    .digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computedHash !== hash) {
    throw new ApiError(401, "initData imzosi noto'g'ri");
  }

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > INIT_DATA_MAX_AGE_SECONDS) {
    throw new ApiError(401, "initData muddati tugagan, Mini App'ni qayta oching");
  }

  let telegramUser;
  try {
    telegramUser = JSON.parse(params.get('user') || '{}');
  } catch {
    throw new ApiError(400, "initData ichidagi foydalanuvchi ma'lumoti noto'g'ri formatda");
  }
  if (!telegramUser.id) {
    throw new ApiError(400, "initData ichida foydalanuvchi ma'lumoti topilmadi");
  }

  const user = await User.findOne({ telegramId: telegramUser.id });
  if (!user) {
    throw new ApiError(404, "Foydalanuvchi topilmadi. Avval botdan ro'yxatdan o'ting");
  }

  if (user.isBlocked) {
    throw new ApiError(403, 'Hisobingiz bloklangan');
  }

  // Telegram profilidagi o'zgarishlarni (ism/username) sinxronlaymiz — xuddi
  // telegramAuth (bot /start) qilganidek
  const fullName = [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ');
  if (fullName) user.name = fullName;
  user.telegramUsername = telegramUser.username ?? user.telegramUsername;
  user.lastLogin = new Date();
  user.downgradeIfPremiumExpired();
  await user.save();

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
        url: frontendLinks.adminPendingUsers(),
        buttonText: '👤 Ko\'rib chiqish',
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
  verifyTelegramWebApp,
};
