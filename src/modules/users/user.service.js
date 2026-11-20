// src/modules/users/user.service.js

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const User = require('./user.model');
const Course = require('../courses/course.model');
const TelegramLinkToken = require('../auth/telegramLinkToken.model');
const notificationService = require('../notifications/notification.service');
const ApiError = require('../../utils/ApiError');
const { logActivity, formatGrade } = require('../user-activity/userActivity.service');
const { getPagination, buildMeta } = require('../../utils/paginate');
const { FRONTEND_URL } = require('../../config/frontendLinks');
const { UPLOADS_ROOT } = require('../../middleware/upload');

const AVATAR_PUBLIC_PREFIX = '/uploads/avatars/';
const AVATARS_DIR = path.resolve(UPLOADS_ROOT, 'avatars');

const TELEGRAM_LINK_TTL_MS = 5 * 60 * 1000; // 5 daqiqa

// Sinf (grade) bu yerda o'zgartirilmaydi — faqat admin/o'qituvchi PATCH /users/:id orqali
const updateMe = async (userId, { name }) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'Foydalanuvchi topilmadi');

  // O'quvchilar o'z ismini o'zgartira olmaydi — admin tasdiqlagan haqiqiy ismi
  // (masalan reyting/natijalarda identifikatsiya uchun) shundayligicha qolishi kerak.
  // Boshqa rollar (teacher/admin/superadmin) uchun bu cheklov yo'q.
  const nameChanged = Boolean(name) && user.role !== 'student' && name !== user.name;
  if (nameChanged) user.name = name;

  await user.save();
  if (nameChanged) {
    await logActivity({ userId: user._id, type: 'profile_updated', meta: { fields: ['name'] } });
  }
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

// POST /users/:id/avatar — superadmin: boshqa foydalanuvchiga avatar belgilaydi/almashtiradi
const setUserAvatar = async (id, publicPath) => {
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, 'Foydalanuvchi topilmadi');

  user.avatar = publicPath;
  await user.save();
  return user;
};

// Avatar faylini diskdan o'chiradi. Faqat bizning /uploads/avatars/ papkamizdagi
// fayllarga tegadi (Telegram'dan kelgan tashqi URL'lar e'tiborsiz qoldiriladi).
// Fayl allaqachon yo'q bo'lsa xato bermaydi.
const deleteAvatarFile = async (publicPath) => {
  if (!publicPath || !publicPath.startsWith(AVATAR_PUBLIC_PREFIX)) return;

  const absolutePath = path.resolve(UPLOADS_ROOT, publicPath.slice('/uploads/'.length));
  if (!absolutePath.startsWith(AVATARS_DIR + path.sep)) return;

  try {
    await fs.promises.unlink(absolutePath);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error("Avatar faylini o'chirishda xato:", error.message);
  }
};

// Avatarni olib tashlaydi (fayl + user.avatar = null). Avatar bo'lmasa ham xato bermaydi.
const clearAvatar = async (id, actorId = null) => {
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, 'Foydalanuvchi topilmadi');

  if (user.avatar) {
    await deleteAvatarFile(user.avatar);
    user.avatar = null;
    await user.save();
    await logActivity({ userId: user._id, type: 'avatar_removed', actorId });
  }
  return user;
};

// DELETE /users/:id/avatar — superadmin: foydalanuvchi avatarini o'chiradi
const deleteUserAvatar = (id, actorId) => clearAvatar(id, actorId);

// DELETE /users/me/avatar — istalgan rol: o'z avatarini o'chiradi (idempotent)
const deleteMyAvatar = (userId) => clearAvatar(userId);

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
  await logActivity({
    userId: user._id,
    type: 'register',
    actorId: createdById,
    meta: { via: 'admin' },
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
  await logActivity({ userId: user._id, type: 'verified', actorId: verifiedById });

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

// PATCH /users/:id/reset-password — superadmin: eski parolni so'ramasdan yangi parol
// o'rnatadi (foydalanuvchi parolni unutganda ishlatiladi). Boshqa qurilmalardagi eski
// tokenlar yaroqsiz bo'lishi uchun tokenVersion oshiriladi, foydalanuvchiga xabar boradi
const resetPassword = async (id, newPassword, actorId = null) => {
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, 'Foydalanuvchi topilmadi');

  user.password = newPassword;
  user.tokenVersion += 1;
  await user.save();
  await logActivity({ userId: user._id, type: 'password_reset', actorId });

  await notificationService.createNotification({
    userId: user._id,
    type: 'system',
    title: 'Parolingiz yangilandi',
    message:
      "Administrator hisobingiz parolini yangiladi. Agar bu siz bo'lmasangiz, administratorga murojaat qiling",
    url: `${FRONTEND_URL}/login`,
    buttonText: '🔑 Tizimga kirish',
  });

  return user;
};

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Effektiv tarif: DB'da tarif='premium' bo'lsa ham, muddati o'tgan bo'lsa (user hali
// login qilmagani uchun downgradeIfPremiumExpired ishlamagan) — bu aslida 'standart'
const buildTarifFilter = (tarif, now = new Date()) => {
  const activePremium = {
    tarif: 'premium',
    $or: [{ premiumExpiresAt: null }, { premiumExpiresAt: { $gt: now } }],
  };
  if (tarif === 'premium') return activePremium;
  if (tarif === 'standart') return { $nor: [activePremium] };
  return null;
};

const getUsers = async ({
  page,
  limit,
  role,
  tarif,
  search,
  isVerified,
  isBlocked,
  grade,
  gradeLetter,
}) => {
  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });

  const filter = {};
  const and = [];
  if (role) filter.role = role;
  const tarifFilter = buildTarifFilter(tarif);
  if (tarifFilter) and.push(tarifFilter);
  // Bo'sh parametr (?isVerified=) filtr sifatida qo'llanmaydi
  if (isVerified === 'true' || isVerified === 'false') filter.isVerified = isVerified === 'true';
  if (isBlocked === 'true' || isBlocked === 'false') filter.isBlocked = isBlocked === 'true';
  if (grade) filter['grade.number'] = Number(grade);
  if (gradeLetter) filter['grade.letter'] = gradeLetter.toUpperCase();
  if (search) {
    // Foydalanuvchi matni regex sifatida emas, oddiy matn sifatida qidiriladi
    // ("+998", "(" kabi belgilar xato bermasin)
    const regex = { $regex: escapeRegex(search), $options: 'i' };
    and.push({ $or: [{ name: regex }, { phone: regex }] });
  }
  if (and.length) filter.$and = and;

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

const setBlocked = async (id, isBlocked, actorId = null) => {
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, 'Foydalanuvchi topilmadi');

  const changed = user.isBlocked !== isBlocked;
  user.isBlocked = isBlocked;
  await user.save();
  if (changed) {
    await logActivity({ userId: user._id, type: isBlocked ? 'blocked' : 'unblocked', actorId });
  }
  return user;
};

// PATCH /users/:id — superadmin: istalgan foydalanuvchini (rol ham) tahrirlaydi
const updateUser = async (id, { name, phone, role, tarif, grade }, actorId = null) => {
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, 'Foydalanuvchi topilmadi');

  // Faollik jurnali uchun — saqlashdan oldingi qiymatlar
  const before = {
    name: user.name,
    phone: user.phone,
    role: user.role,
    tarif: user.tarif,
    grade: formatGrade(user.grade),
  };

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
  await logUserUpdate(user, before, actorId);
  return user;
};

// updateUser'dagi har bir haqiqiy o'zgarish uchun alohida faollik yozuvi
const logUserUpdate = async (user, before, actorId) => {
  const base = { userId: user._id, actorId };
  const profileFields = ['name', 'phone'].filter((f) => before[f] !== user[f]);
  const gradeAfter = formatGrade(user.grade);

  const entries = [];
  if (profileFields.length) {
    entries.push({ ...base, type: 'profile_updated', meta: { fields: profileFields } });
  }
  if (before.role !== user.role) {
    entries.push({ ...base, type: 'role_changed', meta: { from: before.role, to: user.role } });
  }
  if (before.tarif !== user.tarif) {
    entries.push({
      ...base,
      type: 'tarif_changed',
      meta: { from: before.tarif, to: user.tarif, expiresAt: user.premiumExpiresAt ?? null },
    });
  }
  if (before.grade !== gradeAfter) {
    entries.push({ ...base, type: 'grade_changed', meta: { from: before.grade, to: gradeAfter } });
  }

  await Promise.all(entries.map(logActivity));
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
const getLeaderboard = async ({ page, limit }, requesterId, requesterRole) => {
  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });
  const filter = { role: 'student' };

  const [students, total] = await Promise.all([
    User.find(filter)
      .select('name avatar diamonds tarif')
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
    tarif: student.tarif,
  }));

  // "Mening o'rnim" — ro'yxat qaysi sahifada bo'lishidan qat'i nazar, student
  // o'zining aniq o'rnini ko'rishi uchun (frontend oldin birinchi 100 tadan qidirib,
  // topilmasa "100+" deb ko'rsatardi — endi aniq son beriladi)
  let me = null;
  if (requesterId && requesterRole === 'student') {
    const myUser = await User.findById(requesterId).select('diamonds');
    if (myUser) {
      const rank = (await User.countDocuments({ role: 'student', diamonds: { $gt: myUser.diamonds } })) + 1;
      me = { rank, diamonds: myUser.diamonds };
    }
  }

  return { leaderboard, me, meta: buildMeta(total, currentPage, pageLimit) };
};

// GET /users/teachers — testni ulashish uchun "kimga ulashish" select/qidiruv maydonini
// to'ldirish uchun ishlatiladi (telefon raqamini qo'lda kiritish o'rniga). Faqat minimal
// maydonlar (ism/telefon) qaytadi — to'liq /users ro'yxati (admin-only) o'rnini bosmaydi
const searchTeachers = async (requesterId, search) => {
  const filter = { role: 'teacher', _id: { $ne: requesterId } };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  return User.find(filter).select('name phone avatar').sort({ name: 1 }).limit(20);
};

// GET /users/class-roster — Super-ustoz doska asboblari (tasodifiy o'quvchi, guruhlarga bo'lish).
// Faqat minimal maydonlar: telefon/balans kabi shaxsiy ma'lumotlar qaytarilmaydi.
const getClassRoster = async (grade, letter) => {
  return User.find({
    role: 'student',
    'grade.number': grade,
    'grade.letter': letter,
    isBlocked: { $ne: true },
    isVerified: true,
  })
    .select('_id name avatar')
    .sort({ name: 1 })
    .limit(200)
    .lean();
};

module.exports = {
  updateMe,
  changePassword,
  setAvatar,
  setUserAvatar,
  deleteUserAvatar,
  deleteMyAvatar,
  createUser,
  verifyUser,
  resetPassword,
  getUsers,
  getUserById,
  setBlocked,
  updateUser,
  deleteUser,
  createTelegramLinkToken,
  unlinkTelegram,
  getLeaderboard,
  searchTeachers,
  getClassRoster,
};
