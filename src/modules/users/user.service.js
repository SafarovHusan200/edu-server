// src/modules/users/user.service.js

const User = require('./user.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, buildMeta } = require('../../utils/paginate');

const updateMe = async (userId, { name, grade }) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'Foydalanuvchi topilmadi');

  if (name) user.name = name;
  if (grade && user.role === 'student') {
    user.grade = { number: grade.number ?? user.grade?.number, letter: grade.letter ?? user.grade?.letter };
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

const getUsers = async ({ page, limit, role, search }) => {
  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });

  const filter = {};
  if (role) filter.role = role;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageLimit),
    User.countDocuments(filter),
  ]);

  return { users, meta: buildMeta(total, currentPage, pageLimit) };
};

const getUserById = async (id) => {
  const user = await User.findById(id);
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

// GET /users/leaderboard — eng ko'p diamant to'plagan studentlar
const getLeaderboard = async ({ page, limit }) => {
  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });
  const filter = { role: 'student' };

  const [students, total] = await Promise.all([
    User.find(filter).select('name avatar diamonds').sort({ diamonds: -1 }).skip(skip).limit(pageLimit),
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
  getUsers,
  getUserById,
  setBlocked,
  getLeaderboard,
};
