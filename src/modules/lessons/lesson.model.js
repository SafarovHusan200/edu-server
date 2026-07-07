// src/modules/lessons/lesson.model.js

const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: '',
    },

    content: {
      type: String,
      default: '',
    },

    videoUrl: {
      type: String,
      default: null,
    },

    attachments: {
      type: [String],
      default: [],
    },

    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

lessonSchema.index({ course: 1, order: 1 });

module.exports = mongoose.model('Lesson', lessonSchema);
