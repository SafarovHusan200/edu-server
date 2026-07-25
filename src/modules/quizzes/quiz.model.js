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

    isActive: {
      type: Boolean,
      default: true,
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
