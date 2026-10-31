// src/modules/lessons/lesson.service.js

const fs = require('fs');
const path = require('path');
const Lesson = require('./lesson.model');
const Course = require('../courses/course.model');
const Enrollment = require('../enrollment/enrollment.model');
const User = require('../users/user.model');
const courseService = require('../courses/course.service');
const notificationService = require('../notifications/notification.service');
const certificateService = require('../certificates/certificate.service');
const ApiError = require('../../utils/ApiError');
const { LESSON_COMPLETE_REWARD } = require('../../config/gamification');
const { applyDiamondMultiplier } = require('../../utils/diamonds');
const { frontendLinks } = require('../../config/frontendLinks');
const { UPLOADS_ROOT } = require('../../middleware/upload');

// Eski videoni almashtirishda diskdagi faylni o'chiradi. videoUrl tashqi havola
// (masalan YouTube) bo'lishi ham mumkin — faqat o'zimiz /uploads/ ostiga
// yuklagan fayllarnigina o'chirishga urinamiz
const deleteUploadedVideo = (publicPath) => {
  if (!publicPath || !publicPath.startsWith('/uploads/')) return;

  const absolutePath = path.join(UPLOADS_ROOT, publicPath.replace('/uploads/', ''));
  fs.unlink(absolutePath, (error) => {
    if (error && error.code !== 'ENOENT') {
      console.error("Video faylni o'chirishda xato:", error.message);
    }
  });
};

const findCourseOrThrow = async (courseId) => {
  const course = await Course.findById(courseId);
  if (!course) throw new ApiError(404, 'Kurs topilmadi');
  return course;
};

const createLesson = async (
  courseId,
  userId,
  role,
  { title, description, content, videoUrl, order, durationMinutes }
) => {
  const course = await findCourseOrThrow(courseId);

  if (!courseService.isOwnerOrStaff(course, userId, role)) {
    throw new ApiError(403, 'Siz bu kursga dars qo\'sha olmaysiz');
  }

  return Lesson.create({ course: courseId, title, description, content, videoUrl, order, durationMinutes });
};

// GET /courses/:id/lessons — ruxsatga qarab to'liq yoki qulflangan ko'rinishda qaytaradi
const getLessonsByCourse = async (courseId, userId, role) => {
  const course = await findCourseOrThrow(courseId);
  const access = await courseService.hasCourseAccess(course, userId, role);

  const lessons = await Lesson.find({ course: courseId }).sort({ order: 1 });

  return lessons.map((lesson) =>
    access
      ? lesson
      : { _id: lesson._id, title: lesson.title, order: lesson.order, course: lesson.course, locked: true }
  );
};

const getLessonById = async (lessonId, userId, role) => {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw new ApiError(404, 'Dars topilmadi');

  const course = await findCourseOrThrow(lesson.course);
  const access = await courseService.hasCourseAccess(course, userId, role);

  if (!access) {
    return { _id: lesson._id, title: lesson.title, order: lesson.order, course: lesson.course, locked: true };
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

// PATCH /courses/:id/lessons/reorder — darslarni sudrab tartiblash (drag & drop) uchun.
// lessonIds — kursdagi barcha darslarning ID'lari, yangi tartibda. Ro'yxat kursdagi
// darslar bilan AYNAN bir xil to'plam bo'lishi shart (yo'q qolgan/ortiqcha bo'lmasligi uchun).
const reorderLessons = async (courseId, userId, role, lessonIds) => {
  const course = await findCourseOrThrow(courseId);

  if (!courseService.isOwnerOrStaff(course, userId, role)) {
    throw new ApiError(403, "Siz bu kursning darslarini tartiblay olmaysiz");
  }

  const existingLessons = await Lesson.find({ course: courseId }).select('_id');
  const existingIds = new Set(existingLessons.map((l) => l._id.toString()));
  const providedIds = lessonIds.map(String);

  const sameSet =
    existingIds.size === providedIds.length &&
    providedIds.every((id) => existingIds.has(id)) &&
    new Set(providedIds).size === providedIds.length;

  if (!sameSet) {
    throw new ApiError(
      400,
      "lessonIds kursdagi barcha darslarni, aynan bittadan va takrorlanmasdan o'z ichiga olishi kerak"
    );
  }

  await Promise.all(
    providedIds.map((lessonId, index) => Lesson.findByIdAndUpdate(lessonId, { order: index }))
  );

  return Lesson.find({ course: courseId }).sort({ order: 1 });
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

// POST /lessons/:id/video — darsning ASOSIY videosini yuklash (lesson.videoUrl'ni
// belgilaydi). addMaterial'dan farqli: attachments'ga qo'shilmaydi, va eski video
// fayl bo'lsa (tashqi havola emas, o'zimiz yuklagan bo'lsa) almashtirishda o'chiriladi.
const setVideo = async (lessonId, userId, role, publicPath, durationMinutes) => {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw new ApiError(404, 'Dars topilmadi');

  const course = await findCourseOrThrow(lesson.course);
  if (!courseService.isOwnerOrStaff(course, userId, role)) {
    throw new ApiError(403, 'Siz bu darsni tahrirlay olmaysiz');
  }

  deleteUploadedVideo(lesson.videoUrl);
  lesson.videoUrl = publicPath;
  if (durationMinutes !== undefined) {
    lesson.durationMinutes = durationMinutes;
  }

  await lesson.save();
  return lesson;
};

// POST /lessons/:id/complete — student darsni tugatgani uchun diamond oladi (idempotent)
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

  const student = await User.findById(studentId).select('tarif');
  const diamondAmount = applyDiamondMultiplier(LESSON_COMPLETE_REWARD, student?.tarif);
  await User.findByIdAndUpdate(studentId, { $inc: { diamonds: diamondAmount } });

  await notificationService.createNotification({
    userId: studentId,
    type: 'lesson',
    title: '💎 Diamond qo\'lga kiritdingiz!',
    message: `📖 Kurs: "${course.title}"\n✅ Dars: "${lesson.title}"\n💎 Mukofot: ${diamondAmount} diamond`,
    meta: { lessonId: lesson._id, courseId: course._id, diamonds: diamondAmount },
    url: frontendLinks.course(course._id),
    buttonText: '📖 Davom etish',
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
  reorderLessons,
  deleteLesson,
  addMaterial,
  setVideo,
  completeLesson,
};
