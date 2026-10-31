// src/utils/lessonsCount.js
// course.service.js va enrollment.service.js kurslar ro'yxatiga lessonsCount/studentsCount
// qo'shish uchun shu helperlardan foydalanadi. Lesson/Enrollment model'larga to'g'ridan-to'g'ri
// murojaat qiladi (lesson.service/enrollment.service'ga emas) — course.service bilan ular
// orasidagi mavjud circular require'ga yana bittasini qo'shmaslik uchun. Ikkalasi ham
// Course modelida saqlanadigan hisoblagich emas — har so'rovda aggregate bilan hisoblanadi,
// shuning uchun migratsiya skripti kerak emas va har doim aniq qiymat qaytadi.

const Lesson = require('../modules/lessons/lesson.model');
const Enrollment = require('../modules/enrollment/enrollment.model');

// courseId(string) -> darslar soni Map qaytaradi, bitta aggregate so'rovda
const countLessonsByCourse = async (courseIds) => {
  if (!courseIds.length) return new Map();

  const counts = await Lesson.aggregate([
    { $match: { course: { $in: courseIds } } },
    { $group: { _id: '$course', count: { $sum: 1 } } },
  ]);

  return new Map(counts.map((c) => [c._id.toString(), c.count]));
};

// courseId(string) -> yozilganlar soni Map qaytaradi (bekor qilinganlar hisobga olinmaydi)
const countStudentsByCourse = async (courseIds) => {
  if (!courseIds.length) return new Map();

  const counts = await Enrollment.aggregate([
    { $match: { course: { $in: courseIds }, status: { $ne: 'cancelled' } } },
    { $group: { _id: '$course', count: { $sum: 1 } } },
  ]);

  return new Map(counts.map((c) => [c._id.toString(), c.count]));
};

module.exports = { countLessonsByCourse, countStudentsByCourse };
