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

const getEffectiveMaxAttempts = (quiz, teacherTarif) => {
  if (teacherTarif === 'premium') return quiz.maxAttempts;
  return Math.min(quiz.maxAttempts, STANDARD_MAX_ATTEMPTS);
};

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
  grade,
  createdBy,
}) => {
  if (targetType !== 'standalone' && !targetId) {
    throw new ApiError(400, 'Course yoki Lesson uchun targetId kiritilishi shart');
  }

  if (availableFrom && availableUntil && new Date(availableUntil) <= new Date(availableFrom)) {
    throw new ApiError(400, "availableUntil availableFrom dan keyin bo'lishi kerak");
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
    grade,
    createdBy,
  });

  return quiz;
};

// Grade bo'yicha minimal savol soni — uch bosqich: 1-4 (boshlang'ich), 5-8 (o'rta), 9-11 (yuqori)
const getMinQuestions = (grade) => {
  if (grade <= ELEMENTARY_MAX_GRADE) return MIN_QUESTIONS_ELEMENTARY;
  if (grade <= MIDDLE_MAX_GRADE) return MIN_QUESTIONS_MIDDLE;
  return MIN_QUESTIONS_SENIOR;
};

const getGradeTierLabel = (grade) => {
  if (grade <= ELEMENTARY_MAX_GRADE) return "boshlang'ich sinflar";
  if (grade <= MIDDLE_MAX_GRADE) return '5-8-sinflar';
  return '9-sinf va undan yuqori sinflar';
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
      const effectiveMaxAttempts = getEffectiveMaxAttempts(quiz, quiz.createdBy?.tarif);
      return { ...quiz.toObject(), questionsCount, effectiveMaxAttempts };
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

  const effectiveMaxAttempts = getEffectiveMaxAttempts(quiz, quiz.createdBy?.tarif);

  return { quiz: { ...quiz.toObject(), effectiveMaxAttempts }, questions };
};

// ─────────────────────────────────────────
// GET SINGLE QUIZ (teacherga — javoblar bilan)
// ─────────────────────────────────────────
const getQuizByIdWithAnswers = async (quizId) => {
  const quiz = await Quiz.findById(quizId).populate('createdBy', 'name phone tarif');
  if (!quiz) throw new ApiError(404, 'Quiz topilmadi');

  const questions = await Question.find({ quiz: quizId }).sort({ order: 1 });

  const effectiveMaxAttempts = getEffectiveMaxAttempts(quiz, quiz.createdBy?.tarif);

  return { quiz: { ...quiz.toObject(), effectiveMaxAttempts }, questions };
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

  if (updateData.isActive) {
    const grade = updateData.grade ?? quiz.grade;
    const minQuestions = getMinQuestions(grade);
    const questionCount = await Question.countDocuments({ quiz: quizId });

    if (questionCount < minQuestions) {
      const tier = getGradeTierLabel(grade);
      throw new ApiError(
        400,
        `Quizni faollashtirish uchun ${tier} (${grade}-sinf) uchun kamida ${minQuestions} ta savol bo'lishi kerak, hozir ${questionCount} ta`
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
};
