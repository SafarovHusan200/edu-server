// src/modules/quizzes/quizShare.model.js

const mongoose = require('mongoose');

const quizShareSchema = new mongoose.Schema(
  {
    // Asl (manba) quiz — qabul qilingandan keyin ham o'zgarmas tarixiy havola sifatida qoladi
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      required: true,
    },

    fromTeacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    toTeacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },

    // status='accepted' bo'lgandan keyin yaratilgan mustaqil nusxa (toTeacher egalik qiladi)
    clonedQuiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      default: null,
    },

    respondedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

quizShareSchema.index({ toTeacher: 1, status: 1, createdAt: -1 });
quizShareSchema.index({ fromTeacher: 1, createdAt: -1 });

module.exports = mongoose.model('QuizShare', quizShareSchema);
