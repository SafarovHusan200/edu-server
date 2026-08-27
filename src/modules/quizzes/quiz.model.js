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

    // targetGrades ichidagi biror yozuvda alohida maxAttempts ko'rsatilmagan bo'lsa,
    // shu sinf uchun qo'llaniladigan standart (fallback) qiymat
    maxAttempts: {
      type: Number,
      default: 3,
      min: 1,
    },

    // Vaqt limiti (daqiqada) — majburiy. targetGrades ichidagi biror yozuvda
    // alohida timeLimit ko'rsatilmagan bo'lsa, shu sinf uchun standart (fallback) qiymat
    timeLimit: {
      type: Number,
      required: true,
      min: 1,
    },

    // Quiz qaysi sinf(lar) uchun mo'ljallangan — bir nechta sinf/parallel bo'lishi mumkin
    // (masalan 3-A, 3-B, 4-A). letter bo'sh bo'lsa — shu grade raqamining BARCHA
    // parallellari nazarda tutiladi. Har bir yozuv o'zining availableFrom/availableUntil,
    // maxAttempts va timeLimit'iga ega bo'lishi mumkin (masalan 3-A soat 9:00da 30 daqiqa,
    // 2 marta; 3-B soat 10:00da 45 daqiqa, 1 marta) — yozuvda ko'rsatilmagan maydon uchun
    // pastdagi quiz darajasidagi umumiy qiymat qo'llaniladi.
    targetGrades: {
      type: [
        {
          number: { type: Number, required: true, min: 1, max: 11 },
          letter: { type: String, enum: ['A', 'B', 'C', 'D', 'E', null], default: null },
          availableFrom: { type: Date, default: null },
          availableUntil: { type: Date, default: null },
          maxAttempts: { type: Number, default: null, min: 1 },
          timeLimit: { type: Number, default: null, min: 1 },
        },
      ],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'Kamida 1 ta sinf tanlanishi shart',
      },
    },

    //comments
    // Quiz darajasidagi umumiy sana-vaqt oralig'i — targetGrades ichidagi biror
    // yozuvda o'zining availableFrom/availableUntil'i bo'lmasa, shu oraliq qo'llaniladi.
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
