// src/modules/stats/stats.service.js
// Bir nechta resurs (Course, Enrollment, Payment, Quiz) kesib o'tadigan agregat
// statistika — shu sababli alohida modul, biror bitta resursga tegishli emas.

const Course = require('../courses/course.model');
const Enrollment = require('../enrollment/enrollment.model');
const Payment = require('../payment/payment.model');
const Quiz = require('../quizzes/quiz.model');
const QuizAttempt = require('../quiz-attempts/quizAttempt.model');

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

module.exports = { getTeacherStats };
