// src/modules/questions/question.model.js

const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      required: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ['multiple_choice', 'true_false', 'open_ended'],
      required: true,
    },

    // multiple_choice uchun variantlar
    options: [
      {
        label: { type: String }, // "A", "B", "C", "D"
        text: { type: String }, // variant matni
      },
    ],

    // multiple_choice → option index (0,1,2,3)
    // true_false      → true yoki false
    // open_ended      → null (teacher tekshiradi)
    correctAnswer: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Namuna javob (open_ended uchun)
    sampleAnswer: {
      type: String,
      default: null,
    },

    // Har bir savol necha ball
    points: {
      type: Number,
      default: 1,
      min: 1,
    },

    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Question', questionSchema);
