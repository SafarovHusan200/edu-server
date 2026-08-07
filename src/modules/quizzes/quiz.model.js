// src/modules/quizzes/quiz.model.js

const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    // 'course' | 'lesson' | 'standalone'
    targetType: {
      type: String,
      enum: ['course', 'lesson', 'standalone'],
      required: true,
      default: 'standalone',
    },

    // targetType = 'course'  → Course ID
    // targetType = 'lesson'  → Lesson ID
    // targetType = 'standalone' → null
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    passingScore: {
      type: Number,
      default: 60,
      min: 0,
      max: 100,
    },

    maxAttempts: {
      type: Number,
      default: 3,
      min: 1,
    },

    // Vaqt limiti (daqiqada) — majburiy
    timeLimit: {
      type: Number,
      required: true,
      min: 1,
    },

    // Qaysi sinf uchun (1-11) — faollashtirishda minimal savol sonini
    // aniqlash uchun ishlatiladi (boshlang'ich vs katta sinflar)
    grade: {
      type: Number,
      required: true,
      min: 1,
      max: 11,
    },

    // Quizni boshlash mumkin bo'lgan sana-vaqt oralig'i (bir martalik, aniq muddat).
    // Ikkalasi ham ixtiyoriy — bo'sh bo'lsa cheklov yo'q. Faqat "boshlash" (start)
    // amalini cheklaydi, allaqachon boshlangan attempt oraliq tugagach ham submit qilinaveradi.
    availableFrom: {
      type: Date,
      default: null,
    },

    availableUntil: {
      type: Date,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

quizSchema.pre('save', async function () {
  if (this.targetType !== 'standalone' && !this.targetId) {
    throw new Error('Course yoki Lesson uchun targetId kiritilishi shart');
  }
  if (this.targetType === 'standalone') {
    this.targetId = null;
  }
});

module.exports = mongoose.model('Quiz', quizSchema);
