// src/modules/lessons/lesson.service.js

const Lesson = require('./lesson.model');
const Course = require('../courses/course.model');
const Enrollment = require('../enrollment/enrollment.model');
const User = require('../users/user.model');
const courseService = require('../courses/course.service');
const notificationService = require('../notifications/notification.service');
const certificateService = require('../certificates/certificate.service');
const ApiError = require('../../utils/ApiError');
const { LESSON_COMPLETE_REWARD } = require('../../config/gamification');

const findCourseOrThrow = async (courseId) => {
  const course = await Course.findById(courseId);
  if (!course) throw new ApiError(404, 'Kurs topilmadi');
  return course;
};

const createLesson = async (courseId, userId, role, { title, description, content, videoUrl, order }) => {
  const course = await findCourseOrThrow(courseId);

  if (!courseService.isOwnerOrStaff(course, userId, role)) {
    throw new ApiError(403, 'Siz bu kursga dars qo\'sha olmaysiz');
  }

  return Lesson.create({ course: courseId, title, description, content, videoUrl, order });
};

// GET /courses/:id/lessons — ruxsatga qarab to'liq yoki qulflangan ko'rinishda qaytaradi
const getLessonsByCourse = async (courseId, userId, role) => {
  const course = await findCourseOrThrow(courseId);
  const access = await courseService.hasCourseAccess(course, userId, role);

  const lessons = await Lesson.find({ course: courseId }).sort({ order: 1 });

  return lessons.map((lesson) =>
    access
      ? lesson
      : { _id: lesson._id, title: lesson.title, order: lesson.order, locked: true }
  );
};

const getLessonById = async (lessonId, userId, role) => {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw new ApiError(404, 'Dars topilmadi');

  const course = await findCourseOrThrow(lesson.course);
  const access = await courseService.hasCourseAccess(course, userId, role);

  if (!access) {
    return { _id: lesson._id, title: lesson.title, order: lesson.order, locked: true };
  }

  return lesson;
};

const updateLesson = async (lessonId, userId, role, updateData) => {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw new ApiError(404, 'Dars topilmadi');

  const course = await findCourseOrThrow(lesson.course);
  if (!courseService.isOwnerOrStaff(course, userId, role)) {
    throw new ApiError(403, 'Siz bu darsni tahrirlay olmaysiz');
  }

  Object.assign(lesson, updateData);
  await lesson.save();
  return lesson;
};

const deleteLesson = async (lessonId, userId, role) => {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw new ApiError(404, 'Dars topilmadi');

  const course = await findCourseOrThrow(lesson.course);
  if (!courseService.isOwnerOrStaff(course, userId, role)) {
    throw new ApiError(403, "Siz bu darsni o'chira olmaysiz");
  }

  await lesson.deleteOne();
};

const addMaterial = async (lessonId, userId, role, publicPath) => {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw new ApiError(404, 'Dars topilmadi');

  const course = await findCourseOrThrow(lesson.course);
  if (!courseService.isOwnerOrStaff(course, userId, role)) {
    throw new ApiError(403, 'Siz bu darsni tahrirlay olmaysiz');
  }

  lesson.attachments.push(publicPath);
  await lesson.save();
  return lesson;
};

// POST /lessons/:id/complete — student darsni tugatgani uchun diamant oladi (idempotent)
const completeLesson = async (lessonId, studentId) => {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw new ApiError(404, 'Dars topilmadi');

  const course = await findCourseOrThrow(lesson.course);
  const access = await courseService.hasCourseAccess(course, studentId, 'student');
  if (!access) throw new ApiError(403, 'Sizda bu darsga kirish huquqi yo\'q');

  let enrollment = await Enrollment.findOne({ student: studentId, course: course._id });

  if (!enrollment) {
    // Faqat bepul kursda enrollmentsiz kirish mumkin — shu yerda yaratib olamiz
    enrollment = await Enrollment.create({ student: studentId, course: course._id });
  }

  const alreadyCompleted = enrollment.completedLessons.some(
    (entry) => entry.lesson.toString() === lessonId.toString()
  );

  if (alreadyCompleted) {
    return { enrollment, alreadyCompleted: true };
  }

  enrollment.completedLessons.push({ lesson: lessonId });

  const totalLessons = await Lesson.countDocuments({ course: course._id });
  const justCompletedCourse =
    enrollment.status !== 'completed' && enrollment.completedLessons.length >= totalLessons;

  if (justCompletedCourse) {
    enrollment.status = 'completed';
  }

  await enrollment.save();
  await User.findByIdAndUpdate(studentId, { $inc: { diamonds: LESSON_COMPLETE_REWARD } });

  await notificationService.createNotification({
    userId: studentId,
    type: 'lesson',
    title: 'Diamant qo\'lga kiritdingiz!',
    message: `"${lesson.title}" darsini tugatganingiz uchun ${LESSON_COMPLETE_REWARD} diamant oldingiz`,
    meta: { lessonId: lesson._id, courseId: course._id, diamonds: LESSON_COMPLETE_REWARD },
  });

  if (justCompletedCourse) {
    await certificateService.issueCertificate(studentId, course._id);
  }

  return { enrollment, alreadyCompleted: false };
};

module.exports = {
  createLesson,
  getLessonsByCourse,
  getLessonById,
  updateLesson,
  deleteLesson,
  addMaterial,
  completeLesson,
};
