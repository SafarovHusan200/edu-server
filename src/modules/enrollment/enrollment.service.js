// src/modules/enrollment/enrollment.service.js

const Enrollment = require('./enrollment.model');
const Course = require('../courses/course.model');
const paymentService = require('../payment/payment.service');
const notificationService = require('../notifications/notification.service');
const ApiError = require('../../utils/ApiError');
const { getPagination, buildMeta } = require('../../utils/paginate');

const ACTIVE_STATUSES = ['active', 'completed'];

// Boshqa modullar (course/lesson/review) uchun: student shu kursga kira oladimi?
const hasActiveAccess = async (courseId, studentId) => {
  if (!studentId) return false;
  return Enrollment.exists({
    course: courseId,
    student: studentId,
    status: { $in: ACTIVE_STATUSES },
  });
};

// POST /api/v1/enrollment  { courseId }
// Bepul kurs bo'lsa — darhol enrollment yaratadi.
// Pullik kurs bo'lsa — to'lov yaratib checkoutUrl qaytaradi (enrollment to'lov
// muvaffaqiyatli bo'lgach payment.service.applyCallback ichida yaratiladi).
const enroll = async (studentId, courseId) => {
  const course = await Course.findById(courseId);
  if (!course || !course.isPublished) {
    throw new ApiError(404, 'Kurs topilmadi');
  }

  const existing = await Enrollment.findOne({ student: studentId, course: courseId });
  if (existing && existing.status !== 'cancelled') {
    throw new ApiError(400, 'Siz bu kursga allaqachon yozilgansiz');
  }

  if (course.price > 0) {
    const { payment, checkoutUrl } = await paymentService.createPayment({
      userId: studentId,
      purpose: 'course',
      courseId,
    });

    return { requiresPayment: true, invoiceId: payment.invoiceId, checkoutUrl };
  }

  const enrollment = existing
    ? await Enrollment.findByIdAndUpdate(
        existing._id,
        { status: 'active', enrolledAt: new Date() },
        { new: true }
      )
    : await Enrollment.create({ student: studentId, course: courseId });

  await notificationService.createNotification({
    userId: studentId,
    type: 'enrollment',
    title: "Kursga yozildingiz",
    message: `Siz "${course.title}" kursiga muvaffaqiyatli yozildingiz`,
    meta: { courseId: course._id },
  });

  return { requiresPayment: false, enrollment };
};

const getMyEnrollments = async (studentId, { page, limit }) => {
  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });
  const filter = { student: studentId };

  const [enrollments, total] = await Promise.all([
    Enrollment.find(filter)
      .populate('course', 'title thumbnail price ratingAvg')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageLimit),
    Enrollment.countDocuments(filter),
  ]);

  return { enrollments, meta: buildMeta(total, currentPage, pageLimit) };
};

const getEnrollmentById = async (enrollmentId, userId, role) => {
  const enrollment = await Enrollment.findById(enrollmentId)
    .populate('course', 'title thumbnail price teacher')
    .populate('student', 'name phone');

  if (!enrollment) throw new ApiError(404, 'Enrollment topilmadi');

  const isOwner = enrollment.student._id.toString() === userId.toString();
  const isStaff = ['teacher', 'admin', 'superadmin'].includes(role);

  if (!isOwner && !isStaff) {
    throw new ApiError(403, "Siz bu enrollmentni ko'ra olmaysiz");
  }

  return enrollment;
};

module.exports = {
  hasActiveAccess,
  enroll,
  getMyEnrollments,
  getEnrollmentById,
};
