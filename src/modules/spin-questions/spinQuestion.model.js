// src/modules/spin-questions/spinQuestion.model.js
// Kunlik barabon (daily-spin) aylantirilganda chiqadigan savollar banki. Har bir savol
// aniq bir sinfga (1-11) tegishli — admin/superadmin tomonidan boshqariladi.

const mongoose = require('mongoose');

const spinQuestionSchema = new mongoose.Schema(
  {
    grade: {
      type: Number,
      required: true,
      min: 1,
      max: 11,
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

spinQuestionSchema.index({ grade: 1, isActive: 1 });

module.exports = mongoose.model('SpinQuestion', spinQuestionSchema);
