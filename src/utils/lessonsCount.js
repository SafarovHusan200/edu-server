// src/utils/lessonsCount.js
// course.service.js va enrollment.service.js ikkalasi ham kurslar ro'yxatiga
// lessonsCount qo'shish uchun shu helperdan foydalanadi. Lesson.model'ga to'g'ridan-to'g'ri
// murojaat qiladi (lesson.service'ga emas) — course.service <-> lesson.service orasida
// mavjud circular require'ga yana bittasini qo'shmaslik uchun.

const Lesson = require('../modules/lessons/lesson.model');

// courseId(string) -> darslar soni Map qaytaradi, bitta aggregate so'rovda
const countLessonsByCourse = async (courseIds) => {
  if (!courseIds.length) return new Map();

  const counts = await Lesson.aggregate([
    { $match: { course: { $in: courseIds } } },
    { $group: { _id: '$course', count: { $sum: 1 } } },
  ]);

  return new Map(counts.map((c) => [c._id.toString(), c.count]));
};

module.exports = { countLessonsByCourse };
