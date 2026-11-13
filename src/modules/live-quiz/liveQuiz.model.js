// src/modules/live-quiz/liveQuiz.model.js
// Jonli viktorina (doskada o'tkaziladigan, Kahoot uslubidagi) savollar to'plami.
// Oddiy Quiz'dan alohida: bu yerda har savolning o'z taymeri bor, ochiq javobli savol yo'q,
// savol rasmli bo'lishi mumkin. O'yinning o'zi (sessiya) xotirada — liveGame.manager.js.

const mongoose = require('mongoose');

const liveQuestionSchema = new mongoose.Schema(
  {
    // Markdown. Rasmlar ![](/uploads/live-quiz/...) — tekshiruv liveQuiz.text.js'da
    text: { type: String, required: true, trim: true, maxlength: 2000 },

    // /uploads/live-quiz/... — POST /live-quizzes/upload-image orqali yuklanadi
    image: { type: String, default: null },

    // 2-4 ta variant. To'g'ri/noto'g'ri savol uchun shunchaki ["To'g'ri", "Noto'g'ri"]
    options: {
      type: [{ type: String, trim: true, maxlength: 120 }],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length >= 2 && arr.length <= 4,
        message: "Variantlar soni 2-4 ta bo'lishi kerak",
      },
    },

    correctIndex: { type: Number, required: true, min: 0, max: 3 },

    // Javob berish uchun vaqt (soniya)
    timeLimit: { type: Number, default: 20, min: 5, max: 120 },

    // Ball koeffitsienti: 0 — ballsiz (mashq savoli), 1 — oddiy, 2 — ikki barobar
    pointsMultiplier: { type: Number, enum: [0, 1, 2], default: 1 },
  },
  { _id: true }
);

liveQuestionSchema.pre('validate', function () {
  if (this.options && this.correctIndex >= this.options.length) {
    this.invalidate('correctIndex', "correctIndex variantlar sonidan kichik bo'lishi kerak");
  }
});

const liveQuizSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, default: '', maxlength: 500 },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    questions: { type: [liveQuestionSchema], default: [] },
  },
  { timestamps: true }
);

liveQuizSchema.index({ createdBy: 1, updatedAt: -1 });

module.exports = mongoose.model('LiveQuiz', liveQuizSchema);
