// src/modules/certificates/certificate.model.js

const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema(
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

    certificateNumber: {
      type: String,
      required: true,
      unique: true,
    },

    // Public URL, masalan /uploads/certificates/CERT-XXXXXXXXXXXX.pdf
    pdfPath: {
      type: String,
      required: true,
    },

    issuedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

certificateSchema.index({ student: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('Certificate', certificateSchema);
