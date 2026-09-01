// src/modules/stats/stats.service.js
// Bir nechta resurs (Course, Enrollment, Payment, Quiz) kesib o'tadigan agregat
// statistika — shu sababli alohida modul, biror bitta resursga tegishli emas.

const Course = require('../courses/course.model');
const Enrollment = require('../enrollment/enrollment.model');
const Payment = require('../payment/payment.model');
const Quiz = require('../quizzes/quiz.model');
const QuizAttempt = require('../quiz-attempts/quizAttempt.model');
const Lesson = require('../lessons/lesson.model');
const Book = require('../books/book.model');
const User = require('../users/user.model');
const { getPagination, buildMeta } = require('../../utils/paginate');
const { ACTIVITY_WEIGHTS } = require('../../config/teacherActivity');

// GET /stats/teacher — login qilgan teacherning barcha kurslari bo'yicha umumiy dashboard
const getTeacherStats = async (teacherId) => {
  const courses = await Course.find({ teacher: teacherId }).select('_id isPublished ratingAvg ratingCount');
  const courseIds = courses.map((c) => c._id);

  const totalCourses = courses.length;
  const totalPublished = courses.filter((c) => c.isPublished).length;

  const ratedCourses = courses.filter((c) => c.ratingCount > 0);
  const ratingWeightSum = ratedCourses.reduce((sum, c) => sum + c.ratingAvg * c.ratingCount, 0);
  const ratingCountSum = ratedCourses.reduce((sum, c) => sum + c.ratingCount, 0);
  const avgRating = ratingCountSum > 0 ? Math.round((ratingWeightSum / ratingCountSum) * 10) / 10 : 0;

  const [totalStudents, revenueAgg, quizIds] = await Promise.all([
    Enrollment.distinct('student', { course: { $in: courseIds }, status: { $ne: 'cancelled' } }),
    Payment.aggregate([
      { $match: { course: { $in: courseIds }, purpose: 'course', status: 'success' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Quiz.find({ createdBy: teacherId }).distinct('_id'),
  ]);

  const [quizStatsAgg] = await QuizAttempt.aggregate([
    { $match: { quiz: { $in: quizIds }, status: { $in: ['submitted', 'reviewed'] } } },
    {
      $group: {
        _id: null,
        avgScore: { $avg: '$scorePercent' },
        totalAttempts: { $sum: 1 },
        passedCount: { $sum: { $cond: ['$passed', 1, 0] } },
      },
    },
  ]);

  return {
    courses: {
      total: totalCourses,
      published: totalPublished,
    },
    students: {
      total: totalStudents.length,
    },
    rating: {
      avg: avgRating,
    },
    revenue: {
      total: revenueAgg[0]?.total ?? 0,
    },
    quizzes: {
      totalQuizzes: quizIds.length,
      totalAttempts: quizStatsAgg?.totalAttempts ?? 0,
      avgScore: quizStatsAgg?.avgScore ? Math.round(quizStatsAgg.avgScore) : 0,
      passRate:
        quizStatsAgg?.totalAttempts > 0
          ? Math.round((quizStatsAgg.passedCount / quizStatsAgg.totalAttempts) * 100)
          : 0,
    },
  };
};

// GET /stats/top-teachers — platformadagi eng faol o'qituvchilar reytingi.
// "Faollik balli" (activityScore) — yaratilgan kurs/test/dars/kitob sonining
// og'irliklangan yig'indisi (config/teacherActivity.js'dagi ACTIVITY_WEIGHTS).
// O'quvchilar soni va o'rtacha reyting balga KIRMAYDI — ular faqat qo'shimcha
// ko'rsatkich sifatida ko'rsatiladi (sifat/ta'sir haqida tasavvur berish uchun).
// Har bir kontent turi bo'yicha alohida $group orqali hisoblanadi (N+1 emas —
// teacherlar soni qancha bo'lishidan qat'i nazar, doim sobit son so'rov).
const getTopTeachers = async ({ page, limit }) => {
  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });

  const [courseCounts, quizCounts, bookCounts, lessonCounts, studentCounts, ratingAgg, teachers] =
    await Promise.all([
      Course.aggregate([{ $group: { _id: '$teacher', count: { $sum: 1 } } }]),
      Quiz.aggregate([{ $group: { _id: '$createdBy', count: { $sum: 1 } } }]),
      Book.aggregate([{ $group: { _id: '$uploadedBy', count: { $sum: 1 } } }]),
      // Lesson'da teacher maydoni yo'q — Course orqali $lookup bilan topiladi
      Lesson.aggregate([
        { $lookup: { from: 'courses', localField: 'course', foreignField: '_id', as: 'c' } },
        { $unwind: '$c' },
        { $group: { _id: '$c.teacher', count: { $sum: 1 } } },
      ]),
      // Har bir teacher uchun NOYOB o'quvchilar soni (bir student bir nechta
      // kursga yozilgan bo'lsa ham bir marta hisoblanadi)
      Enrollment.aggregate([
        { $match: { status: { $in: ['active', 'completed'] } } },
        { $lookup: { from: 'courses', localField: 'course', foreignField: '_id', as: 'c' } },
        { $unwind: '$c' },
        { $group: { _id: '$c.teacher', students: { $addToSet: '$student' } } },
        { $project: { count: { $size: '$students' } } },
      ]),
      Course.aggregate([
        { $match: { ratingCount: { $gt: 0 } } },
        {
          $group: {
            _id: '$teacher',
            weightedSum: { $sum: { $multiply: ['$ratingAvg', '$ratingCount'] } },
            totalRatings: { $sum: '$ratingCount' },
          },
        },
      ]),
      User.find({ role: 'teacher' }).select('name avatar'),
    ]);

  const toCountMap = (arr) => new Map(arr.map((x) => [x._id?.toString(), x.count]));
  const courseMap = toCountMap(courseCounts);
  const quizMap = toCountMap(quizCounts);
  const bookMap = toCountMap(bookCounts);
  const lessonMap = toCountMap(lessonCounts);
  const studentMap = toCountMap(studentCounts);
  const ratingMap = new Map(
    ratingAgg.map((r) => [r._id?.toString(), Math.round((r.weightedSum / r.totalRatings) * 10) / 10])
  );

  const rows = teachers.map((teacher) => {
    const id = teacher._id.toString();
    const coursesCount = courseMap.get(id) ?? 0;
    const quizzesCount = quizMap.get(id) ?? 0;
    const lessonsCount = lessonMap.get(id) ?? 0;
    const booksCount = bookMap.get(id) ?? 0;

    const activityScore =
      coursesCount * ACTIVITY_WEIGHTS.course +
      quizzesCount * ACTIVITY_WEIGHTS.quiz +
      lessonsCount * ACTIVITY_WEIGHTS.lesson +
      booksCount * ACTIVITY_WEIGHTS.book;

    return {
      _id: teacher._id,
      name: teacher.name,
      avatar: teacher.avatar,
      coursesCount,
      quizzesCount,
      lessonsCount,
      booksCount,
      studentsCount: studentMap.get(id) ?? 0,
      avgRating: ratingMap.get(id) ?? 0,
      activityScore,
    };
  });

  // Ball bo'yicha, teng bo'lsa o'quvchilar soni bo'yicha ajratiladi
  rows.sort((a, b) => b.activityScore - a.activityScore || b.studentsCount - a.studentsCount);

  const total = rows.length;
  const paged = rows.slice(skip, skip + pageLimit).map((row, index) => ({
    rank: skip + index + 1,
    ...row,
  }));

  return { teachers: paged, meta: buildMeta(total, currentPage, pageLimit) };
};

module.exports = { getTeacherStats, getTopTeachers };
