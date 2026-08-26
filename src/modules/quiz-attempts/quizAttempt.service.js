// src/modules/quiz-attempts/quizAttempt.service.js

const QuizAttempt = require('./quizAttempt.model');
const Quiz = require('../quizzes/quiz.model');
const {
  getEffectiveMaxAttempts,
  findMatchingTargetGrade,
  getEffectiveAvailability,
} = require('../quizzes/quiz.service');
const Question = require('../questions/question.model');
const User = require('../users/user.model');
const notificationService = require('../notifications/notification.service');
const ApiError = require('../../utils/ApiError');
const { QUIZ_MAX_REWARD } = require('../../config/gamification');
const { applyDiamondMultiplier } = require('../../utils/diamonds');

// Xato xabarlarida vaqtni har doim Toshkent vaqti bilan, "10:10 01.01.2026"
// shaklida ko'rsatish uchun (server qaysi timezone'da ishlashidan qat'i nazar)
const formatTashkentTime = (date) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value;

  return `${get('hour')}:${get('minute')} ${get('day')}.${get('month')}.${get('year')}`;
};

// attempt 'reviewed' bo'lganda diamond beradi — faqat bir marta va faqat birinchi
// urinishda (attemptNumber 1), qayta-qayta urinib diamond "farm" qilib olmaslik uchun.
// Miqdor natijaga proportsional (passed/failed'dan qat'i nazar):
// scorePercent/100 * QUIZ_MAX_REWARD — masalan 100% -> 10, 70% -> 7, 75% -> 7.5.
// (submitAttempt va reviewOpenEnded ikkalasi ham shu holatga olib kelishi mumkin)
const awardQuizDiamonds = async (attempt, quizTitle, teacherName) => {
  if (attempt.diamondsAwarded || attempt.attemptNumber !== 1) return;

  const student = await User.findById(attempt.student).select('tarif');
  const baseAmount = Math.round((attempt.scorePercent / 100) * QUIZ_MAX_REWARD * 100) / 100;
  const diamondAmount = applyDiamondMultiplier(baseAmount, student?.tarif);
  attempt.diamondsAwarded = true;

  if (diamondAmount <= 0) return;

  await User.findByIdAndUpdate(attempt.student, { $inc: { diamonds: diamondAmount } });

  await notificationService.createNotification({
    userId: attempt.student,
    type: 'quiz',
    title: '💎 Diamond qo\'lga kiritdingiz!',
    message: `📚 Fan: "${quizTitle}"\n👨‍🏫 O'qituvchi: ${teacherName ?? "—"}\n💎 Mukofot: ${diamondAmount} diamond`,
    meta: { quizId: attempt.quiz._id ?? attempt.quiz, attemptId: attempt._id },
  });
};

// ─────────────────────────────────────────
// START ATTEMPT
// ─────────────────────────────────────────
const startAttempt = async (quizId, studentId) => {
  const quiz = await Quiz.findById(quizId).populate('createdBy', 'tarif');
  if (!quiz) throw new ApiError(404, 'Quiz topilmadi');
  if (!quiz.isActive) throw new ApiError(400, 'Bu quiz faol emas');

  // Bu quiz studentning sinfi (grade.number/letter) uchun mo'ljallanganmi —
  // bir nechta sinf (masalan 3-A, 3-B, 4-A) tanlangan bo'lishi mumkin
  const student = await User.findById(studentId).select('grade');
  const matchedGrade = findMatchingTargetGrade(quiz, student?.grade);
  if (!matchedGrade) {
    throw new ApiError(403, "Bu test sizning sinfingiz uchun mo'ljallanmagan");
  }

  // Har bir sinf (masalan 3-A va 3-B) o'zining alohida boshlash oralig'iga ega
  // bo'lishi mumkin — belgilanmagan bo'lsa quiz darajasidagi umumiy oraliq qo'llaniladi
  const { availableFrom, availableUntil } = getEffectiveAvailability(quiz, matchedGrade);

  // Faqat "boshlash"ni cheklaydi — allaqachon boshlangan attempt oraliq
  // tugagach ham submit qilinaveradi (pastdagi submitAttempt'da tekshirilmaydi)
  const now = new Date();
  if (availableFrom && now < availableFrom) {
    throw new ApiError(
      400,
      `Bu quiz hali boshlanmagan. Boshlanish vaqti: ${formatTashkentTime(availableFrom)} (Toshkent vaqti)`
    );
  }
  if (availableUntil && now > availableUntil) {
    throw new ApiError(
      400,
      `Bu quizni boshlash muddati tugagan. Muddat: ${formatTashkentTime(availableUntil)} (Toshkent vaqti)`
    );
  }

  // Necha marta uringan
  const attemptCount = await QuizAttempt.countDocuments({ quiz: quizId, student: studentId });

  // Standart tarifdagi o'qituvchining testida 1 martagacha, premiumda so'ralgan
  // qiymatgacha (matchedGrade'da alohida ko'rsatilgan bo'lsa o'sha, aks holda quiz.maxAttempts)
  const requestedMaxAttempts = matchedGrade.maxAttempts ?? quiz.maxAttempts;
  const effectiveMaxAttempts = getEffectiveMaxAttempts(quiz, quiz.createdBy?.tarif, matchedGrade);

  if (attemptCount >= effectiveMaxAttempts) {
    const premiumHint =
      effectiveMaxAttempts < requestedMaxAttempts
        ? " (ko'proq urinish uchun o'qituvchi premium tarifga o'tishi kerak)"
        : '';
    throw new ApiError(
      400,
      `Siz bu quizga ${effectiveMaxAttempts} martadan ko'p urina olmaysiz${premiumHint}`
    );
  }

  // Tugallanmagan attempt bormi
  const inProgress = await QuizAttempt.findOne({
    quiz: quizId,
    student: studentId,
    status: 'in_progress',
  });

  if (inProgress) return inProgress; // qayta boshlash o'rniga davom ettiradi

  const attempt = await QuizAttempt.create({
    quiz: quizId,
    student: studentId,
    attemptNumber: attemptCount + 1,
    startedAt: new Date(),
  });

  return attempt;
};

// ─────────────────────────────────────────
// SUBMIT ATTEMPT
// ─────────────────────────────────────────
const submitAttempt = async (attemptId, studentId, answers) => {
  // answers = [{ questionId, givenAnswer }, ...]

  const attempt = await QuizAttempt.findById(attemptId);
  if (!attempt) throw new ApiError(404, 'Attempt topilmadi');

  if (attempt.student.toString() !== studentId.toString()) {
    throw new ApiError(403, 'Bu attempt sizniki emas');
  }

  if (attempt.status !== 'in_progress') {
    throw new ApiError(400, 'Bu attempt allaqachon yakunlangan');
  }

  const quiz = await Quiz.findById(attempt.quiz);
  const questions = await Question.find({ quiz: attempt.quiz });

  let totalPoints = 0;
  let earnedPoints = 0;

  const evaluatedAnswers = questions.map((question) => {
    totalPoints += question.points;

    const studentAnswer = answers.find((a) => a.questionId.toString() === question._id.toString());

    const givenAnswer = studentAnswer?.givenAnswer ?? null;

    let isCorrect = false;
    let pointsEarned = 0;

    if (question.type === 'open_ended') {
      // open_ended — teacher keyinroq tekshiradi
      isCorrect = false;
      pointsEarned = 0;
    } else {
      isCorrect = String(givenAnswer) === String(question.correctAnswer);
      if (isCorrect) {
        pointsEarned = question.points;
        earnedPoints += question.points;
      }
    }

    return {
      question: question._id,
      givenAnswer,
      isCorrect,
      pointsEarned,
    };
  });

  const scorePercent = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

  const passed = scorePercent >= quiz.passingScore;

  // Open ended savollar bo'lsa — 'reviewed' kutadi
  const hasOpenEnded = questions.some((q) => q.type === 'open_ended');

  attempt.answers = evaluatedAnswers;
  attempt.totalPoints = totalPoints;
  attempt.earnedPoints = earnedPoints;
  attempt.scorePercent = scorePercent;
  attempt.passed = passed;
  attempt.status = hasOpenEnded ? 'submitted' : 'reviewed';
  attempt.submittedAt = new Date();

  const [student, teacher] = await Promise.all([
    User.findById(studentId).select('name'),
    User.findById(quiz.createdBy).select('name'),
  ]);

  const correctCount = evaluatedAnswers.filter((a) => a.isCorrect).length;
  const totalQuestions = evaluatedAnswers.length;

  if (attempt.status === 'reviewed') {
    // Avtomatik baholangan (ochiq savolsiz) — natija darhol tayyor,
    // shuning uchun ham studentga, ham testni tuzgan o'qituvchiga xabar boradi
    await awardQuizDiamonds(attempt, quiz.title, teacher?.name);

    await notificationService.createNotification({
      userId: attempt.student,
      type: 'quiz',
      title: passed ? '🏆 Test yakunlandi — o\'tdingiz!' : '📊 Test yakunlandi',
      message: `📚 Fan: "${quiz.title}"\n👨‍🏫 O'qituvchi: ${teacher?.name ?? "—"}\n✅ Natija: ${correctCount}/${totalQuestions} ta savolga to'g'ri javob berdingiz (${scorePercent}%)\n${passed ? "🎉 Tabriklaymiz, testdan muvaffaqiyatli o'tdingiz!" : "💪 O'tish balidan past natija — qayta urinib ko'ring!"}`,
      meta: { quizId: quiz._id, attemptId: attempt._id },
    });

    await notificationService.createNotification({
      userId: quiz.createdBy,
      type: 'quiz',
      title: '📥 Yangi natija',
      message: `👤 O'quvchi: ${student?.name ?? 'Talaba'}\n📚 Fan: "${quiz.title}"\n✅ Natija: ${correctCount}/${totalQuestions} to'g'ri (${scorePercent}%)\n${passed ? "🟢 Holat: o'tdi" : "🔴 Holat: o'ta olmadi"}`,
      meta: { quizId: quiz._id, attemptId: attempt._id, studentId },
    });
  } else {
    // Ochiq savol bor — o'qituvchi tekshirgandan keyin (reviewOpenEnded) student
    // xabar oladi, o'qituvchiga esa faqat "tekshirish kerak" xabari yetarli
    const openEndedCount = questions.filter((q) => q.type === 'open_ended').length;

    await notificationService.createNotification({
      userId: quiz.createdBy,
      type: 'quiz',
      title: '📝 Tekshirish kerak',
      message: `👤 O'quvchi: ${student?.name ?? 'Talaba'}\n📚 Fan: "${quiz.title}"\n❓ ${openEndedCount} ta ochiq savolga javob yubordi — tekshirib, baholab bering`,
      meta: { quizId: quiz._id, attemptId: attempt._id, studentId },
    });
  }

  await attempt.save();

  return attempt;
};

// ─────────────────────────────────────────
// GET MY ATTEMPTS
// ─────────────────────────────────────────
const getMyAttempts = async (quizId, studentId) => {
  const attempts = await QuizAttempt.find({ quiz: quizId, student: studentId }).sort({
    attemptNumber: 1,
  });

  const [quiz, student] = await Promise.all([
    Quiz.findById(quizId).populate('createdBy', 'tarif'),
    User.findById(studentId).select('grade'),
  ]);
  const matchedGrade = findMatchingTargetGrade(quiz, student?.grade);
  const maxAttempts = getEffectiveMaxAttempts(quiz, quiz.createdBy?.tarif, matchedGrade);

  return {
    attempts,
    attemptsUsed: attempts.length,
    attemptsRemaining: maxAttempts - attempts.length,
    maxAttempts,
  };
};

// ─────────────────────────────────────────
// GET ALL RESULTS (teacher / admin)
// ─────────────────────────────────────────
const getQuizResults = async (quizId, teacherId, role) => {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) throw new ApiError(404, 'Quiz topilmadi');

  const isOwner = quiz.createdBy.toString() === teacherId.toString();
  const isAdmin = ['admin', 'superadmin'].includes(role);

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "Siz bu quiz natijalarini ko'ra olmaysiz");
  }

  const attempts = await QuizAttempt.find({
    quiz: quizId,
    status: { $in: ['submitted', 'reviewed'] },
  })
    .populate('student', 'name phone')
    .sort({ createdAt: -1 });

  return attempts;
};

// ─────────────────────────────────────────
// REVIEW OPEN ENDED (teacher)
// ─────────────────────────────────────────
const reviewOpenEnded = async (attemptId, teacherId, reviewedAnswers) => {
  // reviewedAnswers = [{ questionId, pointsEarned, isCorrect, feedback? }]
  // isCorrect va pointsEarned bir-biridan mustaqil — ustoz qisman ball berib,
  // baribir "to'liq to'g'ri emas" deb belgilashi mumkin (yoki aksincha)

  const attempt = await QuizAttempt.findById(attemptId).populate({
    path: 'quiz',
    populate: { path: 'createdBy', select: 'name' },
  });
  if (!attempt) throw new ApiError(404, 'Attempt topilmadi');

  if (attempt.quiz.createdBy._id.toString() !== teacherId.toString()) {
    throw new ApiError(403, 'Siz bu attemptni tekshira olmaysiz');
  }

  let earnedPoints = 0;

  attempt.answers = attempt.answers.map((ans) => {
    const reviewed = reviewedAnswers.find(
      (r) => r.questionId.toString() === ans.question.toString()
    );

    if (reviewed) {
      ans.pointsEarned = reviewed.pointsEarned;
      ans.isCorrect = Boolean(reviewed.isCorrect);
      ans.feedback = reviewed.feedback ?? null;
    }

    earnedPoints += ans.pointsEarned;
    return ans;
  });

  const scorePercent =
    attempt.totalPoints > 0 ? Math.round((earnedPoints / attempt.totalPoints) * 100) : 0;

  attempt.earnedPoints = earnedPoints;
  attempt.scorePercent = scorePercent;
  attempt.passed = scorePercent >= attempt.quiz.passingScore;
  attempt.status = 'reviewed';

  await awardQuizDiamonds(attempt, attempt.quiz.title, attempt.quiz.createdBy?.name);

  await attempt.save();

  const correctCount = attempt.answers.filter((a) => a.isCorrect).length;
  const totalQuestions = attempt.answers.length;

  await notificationService.createNotification({
    userId: attempt.student,
    type: 'quiz',
    title: '✅ Natijangiz baholandi',
    message: `📚 Fan: "${attempt.quiz.title}"\n👨‍🏫 O'qituvchi: ${attempt.quiz.createdBy?.name ?? '—'}\n📊 Yakuniy natija: ${correctCount}/${totalQuestions} to'g'ri (${scorePercent}%)\n${attempt.passed ? "🎉 Testdan muvaffaqiyatli o'tdingiz!" : "📌 Afsuski, testdan o'ta olmadingiz"}`,
    meta: { quizId: attempt.quiz._id, attemptId: attempt._id },
  });

  return attempt;
};

// quizAttempt.service.js ga qo'shish
const getAttemptById = async (attemptId, userId, role) => {
  const attempt = await QuizAttempt.findById(attemptId)
    .populate('student', 'name phone')
    .populate('answers.question', 'text type points');

  if (!attempt) throw new ApiError(404, 'Attempt topilmadi');

  const isOwner = attempt.student._id.toString() === userId.toString();
  const isTeacher = ['teacher', 'admin', 'superadmin'].includes(role);

  if (!isOwner && !isTeacher) {
    throw new ApiError(403, "Siz bu attemptni ko'ra olmaysiz");
  }

  return attempt;
};

module.exports = {
  startAttempt,
  submitAttempt,
  getMyAttempts,
  getQuizResults,
  reviewOpenEnded,
  getAttemptById,
};
