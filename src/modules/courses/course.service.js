// src/modules/courses/course.service.js

const Course = require('./course.model');
const Category = require('../categories/category.model');
const Lesson = require('../lessons/lesson.model');
const Review = require('../reviews/review.model');
const Enrollment = require('../enrollment/enrollment.model');
const Payment = require('../payment/payment.model');
const Quiz = require('../quizzes/quiz.model');
const QuizAttempt = require('../quiz-attempts/quizAttempt.model');
const enrollmentService = require('../enrollment/enrollment.service');
const ApiError = require('../../utils/ApiError');
const { getPagination, buildMeta } = require('../../utils/paginate');

const isOwnerOrStaff = (course, userId, role) => {
  const isOwner = course.teacher.toString() === userId?.toString();
  const isStaff = ['admin', 'superadmin'].includes(role);
  return isOwner || isStaff;
};

// Berilgan foydalanuvchi kursning to'liq kontentini (darslar matni/videosi) ko'ra oladimi?
// Bepul kurs — hammaga ochiq. Pullik kurs — faqat enroll bo'lgan student yoki egasi/admin.
const hasCourseAccess = async (course, userId, role) => {
  if (course.price === 0) return true;
  if (userId && isOwnerOrStaff(course, userId, role)) return true;
  return enrollmentService.hasActiveAccess(course._id, userId);
};

const createCourse = async ({ title, description, category, price, teacherId }) => {
  const categoryDoc = await Category.findById(category);
  if (!categoryDoc) throw new ApiError(400, "Ko'rsatilgan kategoriya topilmadi");

  return Course.create({
    title,
    description,
    category,
    teacher: teacherId,
    price: price ?? 0,
  });
};

const getCourses = async ({ page, limit, category, teacher, search, userId, role }) => {
  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });

  const isStaff = ['admin', 'superadmin'].includes(role);

  // Odatiy holda faqat published kurslar ko'rinadi. Admin/superadmin — hammasini,
  // login qilgan foydalanuvchi esa o'zining hali publish qilinmagan kurslarini ham ko'radi.
  const filter = isStaff
    ? {}
    : { $or: [{ isPublished: true }, ...(userId ? [{ teacher: userId }] : [])] };

  if (category) filter.category = category;
  if (teacher) filter.teacher = teacher;
  if (search) filter.title = { $regex: search, $options: 'i' };

  const [courses, total] = await Promise.all([
    Course.find(filter)
      .populate('category', 'name slug')
      .populate('teacher', 'name phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageLimit),

    Course.countDocuments(filter),
  ]);

  return { courses, meta: buildMeta(total, currentPage, pageLimit) };
};

const getCourseById = async (courseId, userId, role) => {
  const course = await Course.findById(courseId)
    .populate('category', 'name slug')
    .populate('teacher', 'name phone');

  if (!course) throw new ApiError(404, 'Kurs topilmadi');

  if (!course.isPublished && !isOwnerOrStaff(course, userId, role)) {
    throw new ApiError(404, 'Kurs topilmadi');
  }

  const access = await hasCourseAccess(course, userId, role);

  const lessons = await Lesson.find({ course: courseId }).sort({ order: 1 });
  const lessonList = lessons.map((lesson) =>
    access
      ? lesson
      : {
          _id: lesson._id,
          title: lesson.title,
          order: lesson.order,
          locked: true,
        }
  );

  return { course, lessons: lessonList, hasAccess: access };
};

const updateCourse = async (courseId, userId, role, updateData) => {
  const course = await Course.findById(courseId);
  if (!course) throw new ApiError(404, 'Kurs topilmadi');

  if (!isOwnerOrStaff(course, userId, role)) {
    throw new ApiError(403, 'Siz bu kursni tahrirlay olmaysiz');
  }

  Object.assign(course, updateData);
  await course.save();
  return course;
};

const deleteCourse = async (courseId, userId, role) => {
  const course = await Course.findById(courseId);
  if (!course) throw new ApiError(404, 'Kurs topilmadi');

  if (!isOwnerOrStaff(course, userId, role)) {
    throw new ApiError(403, "Siz bu kursni o'chira olmaysiz");
  }

  const activeEnrollments = await Enrollment.countDocuments({
    course: courseId,
    status: { $ne: 'cancelled' },
  });

  if (activeEnrollments > 0) {
    throw new ApiError(
      400,
      "Bu kursga yozilgan studentlar bor, avval kursni yopilgan holatga o'tkazing"
    );
  }

  await Lesson.deleteMany({ course: courseId });
  await Review.deleteMany({ course: courseId });
  await course.deleteOne();
};

const setThumbnail = async (courseId, userId, role, publicPath) => {
  const course = await Course.findById(courseId);
  if (!course) throw new ApiError(404, 'Kurs topilmadi');

  if (!isOwnerOrStaff(course, userId, role)) {
    throw new ApiError(403, 'Siz bu kursni tahrirlay olmaysiz');
  }

  course.thumbnail = publicPath;
  await course.save();
  return course;
};

// GET /courses/:id/stats — teacher/admin uchun kurs bo'yicha statistika
const getCourseStats = async (courseId, userId, role) => {
  const course = await Course.findById(courseId);
  if (!course) throw new ApiError(404, 'Kurs topilmadi');

  if (!isOwnerOrStaff(course, userId, role)) {
    throw new ApiError(403, "Siz bu kurs statistikasini ko'ra olmaysiz");
  }

  const [activeCount, completedCount, totalEnrollments, revenueAgg, quizIds] = await Promise.all([
    Enrollment.countDocuments({ course: courseId, status: 'active' }),
    Enrollment.countDocuments({ course: courseId, status: 'completed' }),
    Enrollment.countDocuments({ course: courseId, status: { $ne: 'cancelled' } }),
    Payment.aggregate([
      { $match: { course: course._id, purpose: 'course', status: 'success' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Quiz.find({ targetType: 'course', targetId: courseId }).distinct('_id'),
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
    enrollment: {
      active: activeCount,
      completed: completedCount,
      total: totalEnrollments,
      completionRate:
        totalEnrollments > 0 ? Math.round((completedCount / totalEnrollments) * 100) : 0,
    },
    rating: {
      avg: course.ratingAvg,
      count: course.ratingCount,
    },
    revenue: {
      total: revenueAgg[0]?.total ?? 0,
      paymentCount: revenueAgg[0]?.count ?? 0,
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

module.exports = {
  isOwnerOrStaff,
  hasCourseAccess,
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  setThumbnail,
  getCourseStats,
};
