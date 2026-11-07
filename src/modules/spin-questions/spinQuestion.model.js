// src/modules/spin-questions/spinQuestion.model.js
// Kunlik barabon (daily-spin) aylantirilganda chiqadigan savollar banki —
// admin/superadmin tomonidan boshqariladi. Ikki turi bor:
//   - category='knowledge': aniq bir sinfga (1-11) tegishli bilim savoli, faqat shu
//     sinfdagi studentlarga tushadi (grade majburiy).
//   - category='logic' (2026-11-07'da qo'shildi): mantiqiy savol, sinfdan qat'i nazar
//     BARCHA studentlarga umumiy to'plamdan tasodifiy tushadi (grade bo'sh qoldiriladi).
const mongoose = require('mongoose');

const spinQuestionSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['knowledge', 'logic'],
      default: 'knowledge',
    },

    // Faqat category='knowledge' uchun majburiy — category='logic' uchun null qoladi
    grade: {
      type: Number,
      min: 1,
      max: 11,
      default: null,
    },

    question: {
      type: String,
      required: true,
      trim: true,
    },

    // Aynan 4 ta variant — correctIndex shulardan biriga ishora qiladi
    options: {
      type: [String],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length === 4 && arr.every((o) => o && o.trim()),
        message: "Aynan 4 ta (bo'sh bo'lmagan) variant kiritilishi kerak",
      },
    },

    correctIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

spinQuestionSchema.pre('validate', function () {
  if (this.category === 'knowledge' && !this.grade) {
    this.invalidate('grade', "category='knowledge' uchun grade (1-11) kiritilishi shart");
  }
  if (this.category === 'logic') {
    this.grade = null;
  }
});

spinQuestionSchema.index({ category: 1, grade: 1, isActive: 1 });

module.exports = mongoose.model('SpinQuestion', spinQuestionSchema);
