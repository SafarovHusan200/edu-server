// src/modules/quiz-attempts/quizAttempt.model.js

const mongoose = require('mongoose');

const quizAttemptSchema = new mongoose.Schema(
  {
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      required: true,
    },

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Har bir savolga javob
    answers: [
      {
        question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
        // multiple_choice → 0,1,2,3 (option index)
        // true_false      → true/false
        // open_ended      → string javob (teacher o'zi tekshiradi)
        givenAnswer: { type: mongoose.Schema.Types.Mixed, default: null },
        isCorrect: { type: Boolean, default: false },
        pointsEarned: { type: Number, default: 0 },
      },
    ],

    // Natija
    totalPoints: { type: Number, default: 0 }, // maksimal ball
    earnedPoints: { type: Number, default: 0 }, // olingan ball
    scorePercent: { type: Number, default: 0 }, // % (earnedPoints/totalPoints*100)
    passed: { type: Boolean, default: false },

    // Holat
    status: {
      type: String,
      enum: ['in_progress', 'submitted', 'reviewed'],
      default: 'in_progress',
    },

    // Urinish raqami (1, 2, 3 ...)
    attemptNumber: {
      type: Number,
      required: true,
    },

    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
