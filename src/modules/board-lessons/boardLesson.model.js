// src/modules/board-lessons/boardLesson.model.js
// Super-ustoz → Interaktiv dars: doskada ko'rsatiladigan slaydlar + oxiridagi mashqlar.
// DIQQAT: src/modules/lessons (kurs darslari) bilan aloqasi yo'q.

const mongoose = require('mongoose');

const THEMES = ['ocean', 'sunset', 'forest', 'galaxy', 'candy', 'sun'];
const LAYOUTS = ['text', 'split', 'image'];
const ICONS = [
  'lightbulb', 'book', 'star', 'rocket', 'atom', 'flask', 'calculator', 'compass',
  'globe', 'sprout', 'paw', 'music', 'palette', 'trophy', 'sparkles',
];
const MAX_SLIDES = 50;
const MAX_EXERCISES = 50;

const slideSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, maxlength: 120, default: '' },
    // Markdown. Rasmlar ![](/uploads/board-lessons/...) — tekshiruv boardLesson.text.js'da
    body: { type: String, maxlength: 2000, default: '' },
    // /uploads/board-lessons/... — POST /board-lessons/upload-image orqali yuklanadi
    image: { type: String, default: null },
    layout: { type: String, enum: LAYOUTS, default: 'text' },
    icon: { type: String, enum: [...ICONS, null], default: null },
    // null — darsning umumiy mavzusi ishlatiladi
    theme: { type: String, enum: [...THEMES, null], default: null },
  },
  { _id: true }
);

slideSchema.pre('validate', function () {
  if (!this.title?.trim() && !this.body?.trim() && !this.image) {
    this.invalidate('title', "Slaydda sarlavha, matn yoki rasmdan kamida bittasi bo'lishi kerak");
  }
  if (this.layout !== 'text' && !this.image) {
    this.invalidate('image', `'${this.layout}' ko'rinishi uchun rasm majburiy`);
  }
});

const exerciseSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    image: { type: String, default: null },
    options: {
      type: [{ type: String, trim: true, maxlength: 120 }],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length >= 2 && arr.length <= 4,
        message: "Variantlar soni 2-4 ta bo'lishi kerak",
      },
    },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
  },
  { _id: true }
);

exerciseSchema.pre('validate', function () {
  if (this.options && this.correctIndex >= this.options.length) {
    this.invalidate('correctIndex', "correctIndex variantlar sonidan kichik bo'lishi kerak");
  }
});

const boardLessonSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500, default: null },
    subject: { type: String, trim: true, maxlength: 60, default: null },
    grade: { type: Number, min: 1, max: 11, default: null },
    theme: { type: String, enum: THEMES, default: 'ocean' },

    slides: {
      type: [slideSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= MAX_SLIDES,
        message: `Slaydlar soni ${MAX_SLIDES} tadan oshmasligi kerak`,
      },
    },
    exercises: {
      type: [exerciseSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= MAX_EXERCISES,
        message: `Mashqlar soni ${MAX_EXERCISES} tadan oshmasligi kerak`,
      },
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

boardLessonSchema.index({ createdBy: 1, updatedAt: -1 });

module.exports = mongoose.model('BoardLesson', boardLessonSchema);
module.exports.THEMES = THEMES;
module.exports.LAYOUTS = LAYOUTS;
module.exports.ICONS = ICONS;
module.exports.MAX_SLIDES = MAX_SLIDES;
module.exports.MAX_EXERCISES = MAX_EXERCISES;
