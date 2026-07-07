// src/modules/quizzes/quiz.service.js

const Quiz = require('./quiz.model');
const Question = require('../questions/question.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, buildMeta } = require('../../utils/paginate');

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
  createdBy,
}) => {
  if (targetType !== 'standalone' && !targetId) {
    throw new ApiError(400, 'Course yoki Lesson uchun targetId kiritilishi shart');
  }

  const quiz = await Quiz.create({
    title,
    description,
    targetType,
    targetId: targetType === 'standalone' ? null : targetId,
    passingScore: passingScore ?? 60,
    maxAttempts: maxAttempts ?? 3,
    timeLimit: timeLimit ?? null,
    createdBy,
  });

  return quiz;
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
// GET SINGLE QUIZ (studentga — javoblarsiz)
// ─────────────────────────────────────────
const getQuizById = async (quizId) => {
  const quiz = await Quiz.findById(quizId).populate('createdBy', 'name phone');
  if (!quiz) throw new ApiError(404, 'Quiz topilmadi');

  const questions = await Question.find({ quiz: quizId })
    .select('-correctAnswer')
    .sort({ order: 1 });

  return { quiz, questions };
};

// ─────────────────────────────────────────
// GET SINGLE QUIZ (teacherga — javoblar bilan)
// ─────────────────────────────────────────
const getQuizByIdWithAnswers = async (quizId) => {
  const quiz = await Quiz.findById(quizId).populate('createdBy', 'name phone');
  if (!quiz) throw new ApiError(404, 'Quiz topilmadi');

  const questions = await Question.find({ quiz: quizId }).sort({ order: 1 });

  return { quiz, questions };
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
  getQuizById,
  getQuizByIdWithAnswers,
  updateQuiz,
  deleteQuiz,
  addQuestion,
  updateQuestion,
  deleteQuestion,
};
