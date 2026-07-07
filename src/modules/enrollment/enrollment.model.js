// src/modules/enrollment/enrollment.model.js

const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },

    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active',
    },

    // Pullik kurs bo'lsa — shu enrollmentni yaratgan to'lov
    paymentRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },

    completedLessons: [
      {
        lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
        completedAt: { type: Date, default: Date.now },
      },
    ],

    enrolledAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
