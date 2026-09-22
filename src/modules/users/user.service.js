// src/modules/users/user.service.js

const crypto = require('crypto');
const User = require('./user.model');
const Course = require('../courses/course.model');
const TelegramLinkToken = require('../auth/telegramLinkToken.model');
const notificationService = require('../notifications/notification.service');
const ApiError = require('../../utils/ApiError');
const { getPagination, buildMeta } = require('../../utils/paginate');
const { FRONTEND_URL } = require('../../config/frontendLinks');

const TELEGRAM_LINK_TTL_MS = 5 * 60 * 1000; // 5 daqiqa

const updateMe = async (userId, { name, grade }) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'Foydalanuvchi topilmadi');

  if (name) user.name = name;
  if (grade && user.role === 'student') {
    user.grade = {
      number: grade.number ?? user.grade?.number,
      letter: grade.letter ?? user.grade?.letter,
    };
  }

  await user.save();
  return user;
};

const changePassword = async (userId, { oldPassword, newPassword }) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'Foydalanuvchi topilmadi');

  if (user.password) {
    const isMatch = await user.matchPassword(oldPassword);
    if (!isMatch) throw new ApiError(401, "Joriy parol noto'g'ri");
  }

  user.password = newPassword;
  // Boshqa qurilmalardagi eski tokenlarni yaroqsiz qilamiz, lekin joriy
  // sessiya uzilib qolmasligi uchun yangi token generatsiya qilib qaytaramiz
  user.tokenVersion += 1;
  await user.save();

  const token = user.generateJwtToken();
  return { user, token };
};

const setAvatar = async (userId, publicPath) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'Foydalanuvchi topilmadi');

  user.avatar = publicPath;
  await user.save();
  return user;
};

// POST /users — superadmin: istalgan roldagi (admin/superadmin ham) yangi foydalanuvchi yaratadi
// Admin o'zi yaratganligi sababli qo'shimcha tasdiqlash shart emas — isVerified=true,
// va shu amalni kim bajarganini ham saqlab qo'yamiz (verifiedBy/verifiedAt)
const createUser = async ({ name, phone, password, role, tarif, grade }, createdById) => {
  const existingUser = await User.findOne({ phone });
  if (existingUser) {
    throw new ApiError(400, "Bu telefon raqam allaqachon ro'yxatdan o'tgan");
  }

  const user = await User.create({
    name,
    phone,
    password,
    role,
    tarif,
    grade,
    isVerified: true,
    verifiedBy: createdById,
    verifiedAt: new Date(),
  });
  return user;
};

// PATCH /users/:id/verify — admin/superadmin: ro'yxatdan o'tgan userni tasdiqlaydi (login ochiladi)
// Qaysi admin/superadmin tasdiqlaganini kelajakda audit qilish uchun verifiedBy/verifiedAt saqlanadi
const verifyUser = async (id, verifiedById) => {
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, 'Foydalanuvchi topilmadi');

  if (user.isVerified) {
    throw new ApiError(400, 'Foydalanuvchi allaqachon tasdiqlangan');
  }

  user.isVerified = true;
  user.verifiedBy = verifiedById;
  user.verifiedAt = new Date();
  await user.save();

  await notificationService.createNotification({
    userId: user._id,
    type: 'system',
    title: 'Hisobingiz tasdiqlandi',
    message: 'Administrator hisobingizni tasdiqladi. Endi tizimga kirishingiz mumkin',
    url: `${FRONTEND_URL}/login`,
    buttonText: '🔑 Tizimga kirish',
  });

  return user.populate('verifiedBy', 'name phone role');
};

const getUsers = async ({ page, limit, role, search, isVerified }) => {
  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });

  const filter = {};
  if (role) filter.role = role;
  if (isVerified !== undefined) filter.isVerified = isVerified === 'true' || isVerified === true;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .populate('verifiedBy', 'name phone role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageLimit),
    User.countDocuments(filter),
  ]);

  return { users, meta: buildMeta(total, currentPage, pageLimit) };
};

const getUserById = async (id) => {
  const user = await User.findById(id).populate('verifiedBy', 'name phone role');
  if (!user) throw new ApiError(404, 'Foydalanuvchi topilmadi');
  return user;
};

const setBlocked = async (id, isBlocked) => {
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, 'Foydalanuvchi topilmadi');

  user.isBlocked = isBlocked;
  await user.save();
  return user;
};

// PATCH /users/:id — superadmin: istalgan foydalanuvchini (rol ham) tahrirlaydi
const updateUser = async (id, { name, phone, role, tarif, grade }) => {
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, 'Foydalanuvchi topilmadi');

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (role !== undefined) user.role = role;
  if (tarif !== undefined) user.tarif = tarif;
  if (grade !== undefined) {
    user.grade = {
      number: grade.number ?? user.grade?.number,
      letter: grade.letter ?? user.grade?.letter,
    };
  }

  await user.save();
  return user;
};

// DELETE /users/:id — superadmin
const deleteUser = async (id, requesterId) => {
  if (id === requesterId?.toString()) {
    throw new ApiError(400, "O'zingizni o'chira olmaysiz");
  }

  const user = await User.findById(id);
  if (!user) throw new ApiError(404, 'Foydalanuvchi topilmadi');

  const authoredCourses = await Course.countDocuments({ teacher: id });
  if (authoredCourses > 0) {
    throw new ApiError(
      400,
      "Bu foydalanuvchi kurslar yaratgan, avval kurslarni boshqa o'qituvchiga o'tkazing yoki o'chiring"
    );
  }

  await user.deleteOne();
};

// POST /users/me/telegram/link — profildan bog'lash uchun bir martalik token
const createTelegramLinkToken = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'Foydalanuvchi topilmadi');

  if (user.telegramId) {
    throw new ApiError(400, 'Sizda allaqachon ulangan Telegram hisobi bor');
  }

  const token = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + TELEGRAM_LINK_TTL_MS);

  await TelegramLinkToken.create({ user: userId, token, expiresAt });

  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  const deepLink = botUsername ? `https://t.me/${botUsername}?start=${token}` : null;

  return { token, deepLink, expiresAt };
};

// DELETE /users/me/telegram — profildan Telegramni uzish
const unlinkTelegram = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'Foydalanuvchi topilmadi');

  if (!user.telegramId) {
    throw new ApiError(400, "Sizda ulangan Telegram hisobi yo'q");
  }

  if (!user.password) {
    throw new ApiError(
      400,
      "Telegramni uzishdan oldin parol o'rnating (aks holda hisobingizga kira olmay qolasiz)"
    );
  }

  user.telegramId = undefined;
  user.telegramUsername = null;
  await user.save();
  return user;
};

// GET /users/leaderboard — eng ko'p diamond to'plagan studentlar
const getLeaderboard = async ({ page, limit }) => {
  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });
  const filter = { role: 'student' };

  const [students, total] = await Promise.all([
    User.find(filter)
      .select('name avatar diamonds')
      .sort({ diamonds: -1 })
      .skip(skip)
      .limit(pageLimit),
    User.countDocuments(filter),
  ]);

  const leaderboard = students.map((student, index) => ({
    rank: skip + index + 1,
    _id: student._id,
    name: student.name,
    avatar: student.avatar,
    diamonds: student.diamonds,
  }));

  return { leaderboard, meta: buildMeta(total, currentPage, pageLimit) };
};

module.exports = {
  updateMe,
  changePassword,
  setAvatar,
  createUser,
  verifyUser,
  getUsers,
  getUserById,
  setBlocked,
  updateUser,
  deleteUser,
  createTelegramLinkToken,
  unlinkTelegram,
  getLeaderboard,
};
