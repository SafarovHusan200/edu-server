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
const RewardRedemption = require('../rewards/redemption.model');
const Certificate = require('../certificates/certificate.model');
const { getPagination, buildMeta } = require('../../utils/paginate');
const { ACTIVITY_WEIGHTS } = require('../../config/teacherActivity');

// Asia/Tashkent — doim UTC+5, DST yo'q — shuning uchun oddiy soat qo'shish/ayirish
// bilan "Toshkent oyi boshlanishi"ning haqiqiy UTC lahzasini aniq hisoblash mumkin
const getTashkentMonthStart = (date = new Date()) => {
  const shifted = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  const monthStartShifted = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1));
  return new Date(monthStartShifted.getTime() - 5 * 60 * 60 * 1000);
};

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
const getTopTeachers = async ({ page, limit }, requesterId, requesterRole) => {
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

  // "Mening o'rnim" — ro'yxat qaysi sahifada bo'lishidan qat'i nazar, o'qituvchi
  // o'z o'rnini ko'rishi uchun (rows allaqachon activityScore bo'yicha saralangan)
  let me = null;
  if (requesterRole === 'teacher') {
    const index = rows.findIndex((row) => row._id.toString() === requesterId?.toString());
    if (index !== -1) {
      me = { rank: index + 1, activityScore: rows[index].activityScore };
    }
  }

  return { teachers: paged, me, meta: buildMeta(total, currentPage, pageLimit) };
};

// GET /stats/admin — admin/superadmin dashboard: 7 ta alohida so'rov o'rniga bitta chaqiruv
const getAdminStats = async () => {
  const now = new Date();
  const monthStart = getTashkentMonthStart(now);

  const [students, teachers, pendingUsers, pendingRedemptions, activePremium, paymentsAgg] =
    await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'teacher' }),
      User.countDocuments({ isVerified: false }),
      RewardRedemption.countDocuments({ status: 'pending' }),
      // tarif='premium' bo'lsa-da, muddati chindan ham o'tmagan bo'lishi kerak —
      // downgradeIfPremiumExpired faqat login/authenticate vaqtida ishlaydi, shuning
      // uchun bazadagi tarif maydoni ba'zi userlarda eskirgan (stale) bo'lishi mumkin
      User.countDocuments({
        tarif: 'premium',
        $or: [{ premiumExpiresAt: null }, { premiumExpiresAt: { $gt: now } }],
      }),
      Payment.aggregate([
        { $match: { status: 'success', createdAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);

  return {
    students,
    teachers,
    pendingUsers,
    pendingRedemptions,
    activePremium,
    paymentsThisMonth: {
      total: paymentsAgg[0]?.total ?? 0,
      count: paymentsAgg[0]?.count ?? 0,
    },
  };
};

// GET /stats/student — o'quvchi dashboard
const getStudentStats = async (studentId) => {
  const [enrollments, certificatesCount, student] = await Promise.all([
    Enrollment.find({ student: studentId }).select('completedLessons'),
    Certificate.countDocuments({ student: studentId }),
    User.findById(studentId).select('grade diamonds'),
  ]);

  const completedLessons = enrollments.reduce((sum, e) => sum + e.completedLessons.length, 0);

  const rank = student
    ? (await User.countDocuments({ role: 'student', diamonds: { $gt: student.diamonds } })) + 1
    : null;

  const activeQuizzesCount = student?.grade?.number
    ? await Quiz.countDocuments({
        isActive: true,
        targetGrades: {
          $elemMatch: {
            number: student.grade.number,
            $or: [{ letter: null }, { letter: student.grade.letter }],
          },
        },
      })
    : 0;

  return { completedLessons, certificatesCount, rank, activeQuizzesCount };
};

module.exports = { getTeacherStats, getTopTeachers, getAdminStats, getStudentStats };
