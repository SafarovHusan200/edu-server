// src/modules/live-quiz/liveSession.model.js
// Yakunlangan jonli viktorina natijasi (tarix). O'yin davomida holat xotirada turadi
// (liveGame.manager.js), bu yozuv faqat o'yin tugaganda bir marta saqlanadi.

const mongoose = require('mongoose');

const liveSessionSchema = new mongoose.Schema(
  {
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'LiveQuiz', required: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    pin: { type: String, required: true },
    quizTitle: { type: String, default: '' },

    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },

    // Saralangan (1-o'rin birinchi). user — platformadagi akkaunt bilan qo'shilgan bo'lsa
    players: [
      {
        _id: false,
        name: String,
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        score: Number,
        correctCount: Number,
        rank: Number,
      },
    ],

    questions: [
      {
        _id: false,
        text: String,
        image: String,
        options: [String],
        correctIndex: Number,
        distribution: [Number], // har bir variantni nechta o'yinchi tanlagani
        answeredCount: Number,
        correctCount: Number,
      },
    ],
  },
  { timestamps: true }
);

liveSessionSchema.index({ quiz: 1, createdAt: -1 });
liveSessionSchema.index({ host: 1, createdAt: -1 });

module.exports = mongoose.model('LiveSession', liveSessionSchema);
