// src/modules/quizzes/quiz.service.js

const Quiz = require('./quiz.model');
const Question = require('../questions/question.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, buildMeta } = require('../../utils/paginate');
const {
  ELEMENTARY_MAX_GRADE,
  MIDDLE_MAX_GRADE,
  MIN_QUESTIONS_ELEMENTARY,
  MIN_QUESTIONS_MIDDLE,
  MIN_QUESTIONS_SENIOR,
} = require('../../config/quizRules');
const questionModel = require('../questions/question.model');

// Standart tarifdagi o'qituvchining testlarida studentlar faqat 1 marta urina oladi —
// ko'proq urinish (quiz.maxAttempts) faqat o'qituvchi premium tarifga o'tgandan keyin ishlaydi.
// Bu yerda hisoblanadi (saqlanmaydi), shuning uchun o'qituvchi keyin premium olsa,
// mavjud quizlarni qayta sozlamasdan avtomatik ko'proq urinish ochiladi.
const STANDARD_MAX_ATTEMPTS = 1;

// matchedGrade — shu sinf uchun targetGrades'dagi mos yozuv (bo'lishi yoki bo'lmasligi
// mumkin); uning maxAttempts override'i bo'lsa o'shani, aks holda quiz.maxAttempts'ni
// "so'ralgan" qiymat sifatida oladi, so'ng standart/premium chegarasi qo'llaniladi
const getEffectiveMaxAttempts = (quiz, teacherTarif, matchedGrade) => {
  const requested = matchedGrade?.maxAttempts ?? quiz.maxAttempts;
  if (teacherTarif === 'premium') return requested;
  return Math.min(requested, STANDARD_MAX_ATTEMPTS);
};

// Shu sinf uchun amal qiladigan test ishlash vaqti (daqiqada) — targetGrades
// yozuvida alohida ko'rsatilmagan bo'lsa quiz darajasidagi umumiy qiymat qaytadi
const getEffectiveTimeLimit = (quiz, matchedGrade) => matchedGrade?.timeLimit ?? quiz.timeLimit;

// Studentning grade.number/letter'i quiz.targetGrades'dagi biror yozuvga mos keladimi —
// mos kelsa o'sha yozuvni qaytaradi (aks holda null — student bu testga kira olmaydi).
// letter=null bo'lgan yozuv shu grade raqamining barcha parallellarini qamrab oladi.
const findMatchingTargetGrade = (quiz, studentGrade) => {
  if (!studentGrade?.number) return null;
  return (
    quiz.targetGrades.find(
      (g) => g.number === studentGrade.number && (!g.letter || g.letter === studentGrade.letter)
    ) ?? null
  );
};

// Shu student uchun amal qiladigan boshlash oralig'i — mos kelgan targetGrade
// yozuvida alohida belgilangan bo'lsa o'shani, aks holda quiz darajasidagi
// umumiy availableFrom/availableUntil'ni qaytaradi
const getEffectiveAvailability = (quiz, matchedGrade) => ({
  availableFrom: matchedGrade?.availableFrom ?? quiz.availableFrom,
  availableUntil: matchedGrade?.availableUntil ?? quiz.availableUntil,
});

// Har bir targetGrades yozuvini o'zining effektiv (haqiqiy) maxAttempts/timeLimit
// qiymatlari bilan boyitadi — GET javoblarida ko'rsatish uchun (har bir sinf
// boshqacha bo'lishi mumkinligi sababli, yagona umumiy qiymat yetarli emas)
const enrichTargetGrades = (quiz, teacherTarif) =>
  quiz.targetGrades.map((g) => ({
    ...(g.toObject ? g.toObject() : g),
    effectiveMaxAttempts: getEffectiveMaxAttempts(quiz, teacherTarif, g),
    effectiveTimeLimit: getEffectiveTimeLimit(quiz, g),
  }));

// ─────────────────────────────────────────
// CREATE QUIZ
// ─────────────────────────────────────────
const createQuiz = async ({
  title,
  description,
  targetType,
  targetId,
  passingScore,
  maxAttempts,
  timeLimit,
  availableFrom,
  availableUntil,
  targetGrades,
  createdBy,
}) => {
  if (targetType !== 'standalone' && !targetId) {
    throw new ApiError(400, 'Course yoki Lesson uchun targetId kiritilishi shart');
  }

  if (!Array.isArray(targetGrades) || targetGrades.length === 0) {
    throw new ApiError(400, 'Kamida 1 ta sinf (masalan 3-A) tanlanishi shart');
  }

  if (availableFrom && availableUntil && new Date(availableUntil) <= new Date(availableFrom)) {
    throw new ApiError(400, "availableUntil availableFrom dan keyin bo'lishi kerak");
  }

  for (const g of targetGrades) {
    if (g.availableFrom && g.availableUntil && new Date(g.availableUntil) <= new Date(g.availableFrom)) {
      throw new ApiError(
        400,
        `${g.number}${g.letter ? `-${g.letter}` : ''}-sinf uchun availableUntil availableFrom dan keyin bo'lishi kerak`
      );
    }
  }

  const quiz = await Quiz.create({
    title,
    description,
    targetType,
    targetId: targetType === 'standalone' ? null : targetId,
    passingScore: passingScore ?? 60,
    maxAttempts: maxAttempts ?? 3,
    timeLimit,
    availableFrom: availableFrom ?? null,
    availableUntil: availableUntil ?? null,
    targetGrades,
    createdBy,
  });

  return quiz;
};

// Bitta sinf raqami bo'yicha minimal savol soni — uch bosqich: 1-4 (boshlang'ich), 5-8 (o'rta), 9-11 (yuqori)
const getMinQuestions = (gradeNumber) => {
  if (gradeNumber <= ELEMENTARY_MAX_GRADE) return MIN_QUESTIONS_ELEMENTARY;
  if (gradeNumber <= MIDDLE_MAX_GRADE) return MIN_QUESTIONS_MIDDLE;
  return MIN_QUESTIONS_SENIOR;
};

const getGradeTierLabel = (gradeNumber) => {
  if (gradeNumber <= ELEMENTARY_MAX_GRADE) return "boshlang'ich sinflar";
  if (gradeNumber <= MIDDLE_MAX_GRADE) return '5-8-sinflar';
  return '9-sinf va undan yuqori sinflar';
};

// "3-A, 3-B, 4-A" ko'rinishida — xato xabarlarida va bildirishnomalarda ishlatiladi
const formatTargetGrades = (targetGrades) =>
  targetGrades.map((g) => (g.letter ? `${g.number}-${g.letter}` : `${g.number}-sinf`)).join(', ');

// Bir nechta sinf tanlangan bo'lsa (masalan 3 va 4-sinf aralash), eng "og'ir"
// (ko'proq savol talab qiladigan) sinfga qarab minimal savol soni belgilanadi —
// shunda quiz har qanday tanlangan sinf uchun yetarlicha chuqur bo'ladi
const getStrictestGradeNumber = (targetGrades) => {
  const uniqueNumbers = [...new Set(targetGrades.map((g) => g.number))];
  return uniqueNumbers.reduce((max, n) => (getMinQuestions(n) > getMinQuestions(max) ? n : max));
};

// ─────────────────────────────────────────
// GET QUIZZES — filter bo'yicha
// ─────────────────────────────────────────
const getQuizzes = async ({ targetType, targetId, page, limit }) => {
  const filter = { isActive: true };

  if (targetType) filter.targetType = targetType;
  if (targetType && targetId) filter.targetId = targetId;

  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });

  const [quizzes, total] = await Promise.all([
    Quiz.find(filter)
      .populate('createdBy', 'name phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageLimit),
    Quiz.countDocuments(filter),
  ]);

  return { quizzes, meta: buildMeta(total, currentPage, pageLimit) };
};

// ─────────────────────────────────────────
// GET QUIZZES MY — filter bo'yicha o'qituvchini o'zini testlarini ko'rsatadi
// ─────────────────────────────────────────
const getQuizzesMy = async ({ id, targetType, targetId, page, limit }) => {
  const filter = { createdBy: id };

  if (targetType) filter.targetType = targetType;
  if (targetType && targetId) filter.targetId = targetId;

  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });

  const [quizzes, total] = await Promise.all([
    Quiz.find(filter)
      .populate('createdBy', 'name phone tarif')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageLimit),
    Quiz.countDocuments(filter),
  ]);

  const quizzesWithCounts = await Promise.all(
    quizzes.map(async (quiz) => {
      const questionsCount = await Question.countDocuments({ quiz: quiz._id });
      const targetGrades = enrichTargetGrades(quiz, quiz.createdBy?.tarif);
      return { ...quiz.toObject(), questionsCount, targetGrades };
    })
  );

  return {
    quizzes: quizzesWithCounts,
    meta: buildMeta(total, currentPage, pageLimit),
  };
};

// ─────────────────────────────────────────
// GET SINGLE QUIZ (studentga — javoblarsiz)
// ─────────────────────────────────────────
const getQuizById = async (quizId) => {
  const quiz = await Quiz.findById(quizId).populate('createdBy', 'name phone tarif');
  if (!quiz) throw new ApiError(404, 'Quiz topilmadi');

  const questions = await Question.find({ quiz: quizId })
    .select('-correctAnswer')
    .sort({ order: 1 });

  const targetGrades = enrichTargetGrades(quiz, quiz.createdBy?.tarif);

  return { quiz: { ...quiz.toObject(), targetGrades }, questions };
};

// ─────────────────────────────────────────
// GET SINGLE QUIZ (teacherga — javoblar bilan)
// ─────────────────────────────────────────
const getQuizByIdWithAnswers = async (quizId) => {
  const quiz = await Quiz.findById(quizId).populate('createdBy', 'name phone tarif');
  if (!quiz) throw new ApiError(404, 'Quiz topilmadi');

  const questions = await Question.find({ quiz: quizId }).sort({ order: 1 });

  const targetGrades = enrichTargetGrades(quiz, quiz.createdBy?.tarif);

  return { quiz: { ...quiz.toObject(), targetGrades }, questions };
};

// ─────────────────────────────────────────
// UPDATE QUIZ
// ─────────────────────────────────────────
const updateQuiz = async (quizId, userId, updateData) => {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) throw new ApiError(404, 'Quiz topilmadi');

  if (quiz.createdBy.toString() !== userId.toString()) {
    throw new ApiError(403, 'Siz bu quizni tahrirlay olmaysiz');
  }

  if (updateData.targetGrades !== undefined && updateData.targetGrades.length === 0) {
    throw new ApiError(400, 'Kamida 1 ta sinf (masalan 3-A) tanlanishi shart');
  }

  if (updateData.isActive) {
    const targetGrades = updateData.targetGrades ?? quiz.targetGrades;
    const strictestNumber = getStrictestGradeNumber(targetGrades);
    const minQuestions = getMinQuestions(strictestNumber);
    const questionCount = await Question.countDocuments({ quiz: quizId });

    if (questionCount < minQuestions) {
      const tier = getGradeTierLabel(strictestNumber);
      throw new ApiError(
        400,
        `Quizni faollashtirish uchun ${tier} (${formatTargetGrades(targetGrades)}) uchun kamida ${minQuestions} ta savol bo'lishi kerak, hozir ${questionCount} ta`
      );
    }
  }

  const updated = await Quiz.findByIdAndUpdate(quizId, updateData, { new: true });
  return updated;
};

// ─────────────────────────────────────────
// DELETE QUIZ
// ─────────────────────────────────────────
const deleteQuiz = async (quizId, userId, role) => {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) throw new ApiError(404, 'Quiz topilmadi');

  const isOwner = quiz.createdBy.toString() === userId.toString();
  const isAdmin = ['admin', 'superadmin'].includes(role);

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "Siz bu quizni o'chira olmaysiz");
  }

  await Question.deleteMany({ quiz: quizId });
  await quiz.deleteOne();
};

// ─────────────────────────────────────────
// ADD QUESTION
// ─────────────────────────────────────────
const addQuestion = async (
  quizId,
  userId,
  { text, type, options, correctAnswer, sampleAnswer, points, order }
) => {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) throw new ApiError(404, 'Quiz topilmadi');

  if (quiz.createdBy.toString() !== userId.toString()) {
    throw new ApiError(403, "Siz bu quizga savol qo'sha olmaysiz");
  }

  if (type === 'multiple_choice') {
    if (!options || options.length < 2) {
      throw new ApiError(400, 'Multiple choice uchun kamida 2 ta variant kerak');
    }
    if (correctAnswer === undefined || correctAnswer === null) {
      throw new ApiError(400, "To'g'ri javob ko'rsatilishi shart");
    }
  }

  if (type === 'true_false' && typeof correctAnswer !== 'boolean') {
    throw new ApiError(400, "True/False uchun javob true yoki false bo'lishi kerak");
  }

  const question = await Question.create({
    quiz: quizId,
    text,
    type,
    options: type === 'multiple_choice' ? options : [],
    correctAnswer: type === 'open_ended' ? null : correctAnswer,
    sampleAnswer: type === 'open_ended' ? (sampleAnswer ?? null) : null, // ← qo'shildi
    points: points ?? 1,
    order: order ?? 0,
  });

  return question;
};

// ─────────────────────────────────────────
// UPDATE QUESTION
// ─────────────────────────────────────────
const updateQuestion = async (questionId, userId, updateData) => {
  const question = await Question.findById(questionId).populate('quiz');
  if (!question) throw new ApiError(404, 'Savol topilmadi');

  if (question.quiz.createdBy.toString() !== userId.toString()) {
    throw new ApiError(403, 'Siz bu savolni tahrirlay olmaysiz');
  }

  const updated = await Question.findByIdAndUpdate(questionId, updateData, { new: true });
  return updated;
};

// ─────────────────────────────────────────
// DELETE QUESTION
// ─────────────────────────────────────────
const deleteQuestion = async (questionId, userId) => {
  const question = await Question.findById(questionId).populate('quiz');
  if (!question) throw new ApiError(404, 'Savol topilmadi');

  if (question.quiz.createdBy.toString() !== userId.toString()) {
    throw new ApiError(403, "Siz bu savolni o'chira olmaysiz");
  }

  await question.deleteOne();
};

module.exports = {
  createQuiz,
  getQuizzes,
  getQuizzesMy,
  getQuizById,
  getQuizByIdWithAnswers,
  updateQuiz,
  deleteQuiz,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  getEffectiveMaxAttempts,
  getEffectiveTimeLimit,
  findMatchingTargetGrade,
  getEffectiveAvailability,
  enrichTargetGrades,
  formatTargetGrades,
};
