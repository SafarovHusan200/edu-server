// tests/helpers.js — testlar uchun umumiy fixture yaratuvchilar

const User = require('../src/modules/users/user.model');
const Category = require('../src/modules/categories/category.model');
const Course = require('../src/modules/courses/course.model');

let phoneCounter = 900000000;

const createUser = async (overrides = {}) => {
  phoneCounter += 1;

  const base = {
    name: 'Test User',
    phone: `998${phoneCounter}`,
    password: 'password123',
    role: 'student',
    grade: { number: 5, letter: 'A' },
    // authenticate middleware isVerified'ni talab qiladi (admin tasdiqlash oqimi) —
    // testlarda default holda tasdiqlangan qilib yaratamiz, aks holda hamma
    // himoyalangan so'rov 403 qaytaradi. Ataylab tasdiqlanmagan user kerak bo'lsa
    // overrides orqali { isVerified: false } berish mumkin.
    isVerified: true,
  };

  if (overrides.role && overrides.role !== 'student') {
    delete base.grade;
  }

  const user = await User.create({ ...base, ...overrides });
  const token = user.generateJwtToken();

  return { user, token };
};

const createCategory = async (overrides = {}) => {
  return Category.create({
    name: `Category ${Date.now()}_${Math.random()}`,
    slug: `category-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    ...overrides,
  });
};

const createCourse = async ({ teacherId, categoryId, ...overrides }) => {
  return Course.create({
    title: 'Test Course',
    description: 'desc',
    category: categoryId,
    teacher: teacherId,
    price: 0,
    isPublished: true,
    ...overrides,
  });
};

module.exports = { createUser, createCategory, createCourse };
