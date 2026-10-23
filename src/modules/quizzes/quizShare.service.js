// src/modules/quizzes/quizShare.service.js
// O'qituvchilar bir-biriga test "ulashishi" — ulashish shunchaki nusxa (clone)
// yaratish orqali amalga oshadi: qabul qilgan o'qituvchi testning mustaqil nusxasiga
// ega bo'ladi (o'zi egalik qiladi, o'z sinfiga moslab tahrirlaydi), natijalar va
// urinish limiti (o'qituvchining o'z tarifi) ikkalasida ham mustaqil ishlaydi.

const Quiz = require('./quiz.model');
const Question = require('../questions/question.model');
const QuizShare = require('./quizShare.model');
const User = require('../users/user.model');
const notificationService = require('../notifications/notification.service');
const ApiError = require('../../utils/ApiError');
const { frontendLinks } = require('../../config/frontendLinks');

// POST /quizzes/:id/share — faqat egasi, va faqat 'standalone' testlar uchun
// (course/lesson'ga bog'langan test boshqa o'qituvchiga ulashilsa, u o'ziga
// tegishli bo'lmagan course/lesson'ga bog'lab qoladi — shuning uchun ruxsat etilmagan)
const shareQuiz = async (quizId, fromTeacherId, toTeacherPhone) => {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) throw new ApiError(404, 'Quiz topilmadi');

  if (quiz.createdBy.toString() !== fromTeacherId.toString()) {
    throw new ApiError(403, 'Siz faqat o\'zingiz yaratgan testni ulashishingiz mumkin');
  }

  if (quiz.targetType !== 'standalone') {
    throw new ApiError(
      400,
      "Faqat mustaqil (standalone) testlarni ulashish mumkin — kurs/darsga bog'langan testlar ulashilmaydi"
    );
  }

  const toTeacher = await User.findOne({ phone: toTeacherPhone, role: 'teacher' });
  if (!toTeacher) {
    throw new ApiError(404, "Bu telefon raqamli o'qituvchi topilmadi");
  }

  if (toTeacher._id.toString() === fromTeacherId.toString()) {
    throw new ApiError(400, "O'zingizga ulasha olmaysiz");
  }

  const existingPending = await QuizShare.findOne({
    quiz: quizId,
    toTeacher: toTeacher._id,
    status: 'pending',
  });
  if (existingPending) {
    throw new ApiError(400, 'Bu testni shu o\'qituvchiga allaqachon ulashgansiz, javobini kutmoqdasiz');
  }

  const fromTeacher = await User.findById(fromTeacherId).select('name');

  const share = await QuizShare.create({
    quiz: quizId,
    fromTeacher: fromTeacherId,
    toTeacher: toTeacher._id,
    status: 'pending',
  });

  await notificationService.createNotification({
    userId: toTeacher._id,
    type: 'quiz',
    title: '🔗 Sizga test ulashildi',
    message: `👨‍🏫 ${fromTeacher?.name ?? 'Bir o\'qituvchi'} sizga "${quiz.title}" testini ulashdi. Qabul qilsangiz, o'zingizning mustaqil nusxangiz yaratiladi — uni o'z sinfingizga moslab sozlashingiz mumkin bo'ladi`,
    meta: { shareId: share._id, quizId: quiz._id },
    url: frontendLinks.quizShares(),
    buttonText: "📥 Ko'rib chiqish",
  });

  return share;
};

// GET /quizzes/shares/incoming — menga ulashilgan testlar
const getIncomingShares = async (toTeacherId, { status } = {}) => {
  const filter = { toTeacher: toTeacherId };
  if (status) filter.status = status;

  return QuizShare.find(filter)
    .populate('quiz', 'title timeLimit passingScore targetGrades')
    .populate('fromTeacher', 'name phone')
    .populate('clonedQuiz', 'title isActive')
    .sort({ createdAt: -1 });
};

// GET /quizzes/shares/outgoing — men ulashgan testlar
const getOutgoingShares = async (fromTeacherId, { status } = {}) => {
  const filter = { fromTeacher: fromTeacherId };
  if (status) filter.status = status;

  return QuizShare.find(filter)
    .populate('quiz', 'title')
    .populate('toTeacher', 'name phone')
    .populate('clonedQuiz', 'title isActive')
    .sort({ createdAt: -1 });
};

// PATCH /quizzes/shares/:id/accept — qabul qilish: testning mustaqil nusxasi yaratiladi
const acceptShare = async (shareId, toTeacherId) => {
  const share = await QuizShare.findById(shareId).populate('quiz');
  if (!share) throw new ApiError(404, "Ulashish so'rovi topilmadi");

  if (share.toTeacher.toString() !== toTeacherId.toString()) {
    throw new ApiError(403, "Bu sizga ulashilgan so'rov emas");
  }
  if (share.status !== 'pending') {
    throw new ApiError(400, "Bu so'rov allaqachon javob berilgan");
  }

  const originalQuiz = share.quiz;
  const originalQuestions = await Question.find({ quiz: originalQuiz._id }).sort({ order: 1 });

  // isActive=false — qabul qiluvchi o'z sinfiga (targetGrades) moslab sozlab,
  // ongli ravishda faollashtirmaguncha bu nusxa o'quvchilarga ko'rinmaydi
  const clonedQuiz = await Quiz.create({
    title: originalQuiz.title,
    description: originalQuiz.description,
    targetType: 'standalone',
    targetId: null,
    passingScore: originalQuiz.passingScore,
    maxAttempts: originalQuiz.maxAttempts,
    timeLimit: originalQuiz.timeLimit,
    availableFrom: null,
    availableUntil: null,
    targetGrades: originalQuiz.targetGrades,
    isActive: false,
    createdBy: toTeacherId,
  });

  if (originalQuestions.length > 0) {
    await Question.insertMany(
      originalQuestions.map((q) => ({
        quiz: clonedQuiz._id,
        text: q.text,
        type: q.type,
        options: q.options,
        correctAnswer: q.correctAnswer,
        sampleAnswer: q.sampleAnswer,
        points: q.points,
        order: q.order,
      }))
    );
  }

  share.status = 'accepted';
  share.clonedQuiz = clonedQuiz._id;
  share.respondedAt = new Date();
  await share.save();

  await notificationService.createNotification({
    userId: share.fromTeacher,
    type: 'quiz',
    title: '✅ Test qabul qilindi',
    message: `"${originalQuiz.title}" testingiz qabul qilindi va endi o'quvchiga o'z nusxasi sifatida mavjud`,
    meta: { shareId: share._id },
  });

  return { share, clonedQuiz };
};

// PATCH /quizzes/shares/:id/reject — rad etish
const rejectShare = async (shareId, toTeacherId) => {
  const share = await QuizShare.findById(shareId).populate('quiz', 'title');
  if (!share) throw new ApiError(404, "Ulashish so'rovi topilmadi");

  if (share.toTeacher.toString() !== toTeacherId.toString()) {
    throw new ApiError(403, "Bu sizga ulashilgan so'rov emas");
  }
  if (share.status !== 'pending') {
    throw new ApiError(400, "Bu so'rov allaqachon javob berilgan");
  }

  share.status = 'rejected';
  share.respondedAt = new Date();
  await share.save();

  await notificationService.createNotification({
    userId: share.fromTeacher,
    type: 'quiz',
    title: '❌ Test rad etildi',
    message: `"${share.quiz?.title}" testingiz rad etildi`,
    meta: { shareId: share._id },
  });

  return share;
};

module.exports = {
  shareQuiz,
  getIncomingShares,
  getOutgoingShares,
  acceptShare,
  rejectShare,
};
