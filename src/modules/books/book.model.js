// src/modules/books/book.model.js

const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    author: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: '',
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BookCategory',
      required: true,
    },

    // Qaysi sinf uchun mo'ljallangan (1-11) — ixtiyoriy, bo'sh = barcha sinflar uchun
    grade: {
      type: Number,
      min: 1,
      max: 11,
      default: null,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    coverImage: {
      type: String,
      default: null,
    },

    // Kitobning o'zi (PDF va h.k.) — /uploads/books/... ommaviy yo'l
    file: {
      type: String,
      default: null,
    },

    // Barcha kitoblar bepul — to'lov/kirish cheklovi yo'q
    isPublished: {
      type: Boolean,
      default: false,
    },

    downloadsCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Book', bookSchema);
