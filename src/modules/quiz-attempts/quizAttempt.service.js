// src/modules/quiz-attempts/quizAttempt.service.js

const QuizAttempt = require('./quizAttempt.model');
const Quiz = require('../quizzes/quiz.model');
const Question = require('../questions/question.model');
const ApiError = require('../../utils/ApiError');

// ─────────────────────────────────────────
// START ATTEMPT
// ─────────────────────────────────────────
const startAttempt = async (quizId, studentId) => {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) throw new ApiError(404, 'Quiz topilmadi');
  if (!quiz.isActive) throw new ApiError(400, 'Bu quiz faol emas');

  // Necha marta uringan
  const attemptCount = await QuizAttempt.countDocuments({ quiz: quizId, student: studentId });

  if (attemptCount >= quiz.maxAttempts) {
    throw new ApiError(400, `Siz bu quizga ${quiz.maxAttempts} martadan ko\'p urina olmaysiz`);
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

  const quiz = await Quiz.findById(quizId);

  return {
    attempts,
    attemptsUsed: attempts.length,
    attemptsRemaining: quiz.maxAttempts - attempts.length,
    maxAttempts: quiz.maxAttempts,
  };
};

// ─────────────────────────────────────────
// GET ALL RESULTS (teacher / admin)
// ─────────────────────────────────────────
const getQuizResults = async (quizId) => {
  const attempts = await QuizAttempt.find({
    quiz: quizId,
    status: { $in: ['submitted', 'reviewed'] },
  })
    .populate('student', 'name email')
    .sort({ createdAt: -1 });

  return attempts;
};

// ─────────────────────────────────────────
// REVIEW OPEN ENDED (teacher)
// ─────────────────────────────────────────
const reviewOpenEnded = async (attemptId, teacherId, reviewedAnswers) => {
  // reviewedAnswers = [{ questionId, pointsEarned }]

  const attempt = await QuizAttempt.findById(attemptId).populate('quiz');
  if (!attempt) throw new ApiError(404, 'Attempt topilmadi');

  if (attempt.quiz.createdBy.toString() !== teacherId.toString()) {
    throw new ApiError(403, 'Siz bu attemptni tekshira olmaysiz');
  }

  let earnedPoints = 0;

  attempt.answers = attempt.answers.map((ans) => {
    const reviewed = reviewedAnswers.find(
      (r) => r.questionId.toString() === ans.question.toString()
    );

    if (reviewed) {
      ans.pointsEarned = reviewed.pointsEarned;
      ans.isCorrect = reviewed.pointsEarned > 0;
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

  await attempt.save();

  return attempt;
};

// quizAttempt.service.js ga qo'shish
const getAttemptById = async (attemptId, userId, role) => {
  const attempt = await QuizAttempt.findById(attemptId)
    .populate('student', 'name email')
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
