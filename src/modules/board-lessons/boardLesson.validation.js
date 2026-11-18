// src/modules/board-lessons/boardLesson.validation.js
// DIQQAT: wildcard ("slides.*.x") zanjirlarida .bail() ishlatilmaydi — express-validator 7 da
// bitta elementdagi xato bail orqali QOLGAN elementlar tekshiruvini ham to'xtatadi.
// Shuning uchun bir nechta shart bitta custom() ichida tekshiriladi.
// Xato field nomlari express-validator formatida: "slides[2].image", "exercises[0].options" —
// frontend "slides[i]" / "exercises[i]" prefiksi bo'yicha xatoni tegishli kartaga bog'laydi.

const { body } = require('express-validator');
const { THEMES, LAYOUTS, ICONS, MAX_SLIDES, MAX_EXERCISES } = require('./boardLesson.model');
const { checkMarkdown, isOwnImage, UPLOAD_HINT } = require('./boardLesson.text');

const IMAGE_MESSAGE = `Rasm ${UPLOAD_HINT} orqali yuklangan bo'lishi kerak`;

const indexFromPath = (path, prefix) => Number(path.match(new RegExp(`${prefix}\\[(\\d+)\\]`))[1]);

const isFilled = (v) => typeof v === 'string' && v.trim() !== '';

const lessonValidation = [
  body('title')
    .isString()
    .withMessage('Dars nomi kiritilishi shart')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Dars nomi kiritilishi shart')
    .bail()
    .isLength({ max: 120 })
    .withMessage('Nom 120 ta belgidan oshmasligi kerak'),

  body('description')
    .optional({ values: 'null' })
    .isString()
    .withMessage("Tavsif matn bo'lishi kerak")
    .bail()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Tavsif 500 ta belgidan oshmasligi kerak'),

  body('subject')
    .optional({ values: 'null' })
    .isString()
    .withMessage("Fan nomi matn bo'lishi kerak")
    .bail()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Fan nomi 60 ta belgidan oshmasligi kerak'),

  body('grade')
    .optional({ values: 'null' })
    .isInt({ min: 1, max: 11 })
    .withMessage("Sinf 1-11 oralig'ida bo'lishi kerak")
    .toInt(),

  body('theme')
    .optional()
    .isIn(THEMES)
    .withMessage(`Mavzu ${THEMES.join(', ')} dan biri bo'lishi kerak`),

  // ─────────────── Slaydlar ───────────────
  body('slides')
    .optional()
    .isArray({ max: MAX_SLIDES })
    .withMessage(`slides massiv bo'lishi kerak (ko'pi bilan ${MAX_SLIDES} ta)`),

  body('slides.*')
    .custom((slide) => {
      if (!slide || typeof slide !== 'object' || Array.isArray(slide)) {
        throw new Error("Slayd obyekt bo'lishi kerak");
      }
      if (!isFilled(slide.title) && !isFilled(slide.body) && !slide.image) {
        throw new Error("Slaydda sarlavha, matn yoki rasmdan kamida bittasi bo'lishi kerak");
      }
      return true;
    }),

  body('slides.*.title')
    .optional({ values: 'null' })
    .custom((value) => {
      if (typeof value !== 'string') throw new Error("Sarlavha matn bo'lishi kerak");
      if (value.trim().length > 120) throw new Error('Sarlavha 120 ta belgidan oshmasligi kerak');
      return true;
    }),

  body('slides.*.body')
    .optional({ values: 'null' })
    .custom((value) => {
      const error = checkMarkdown(value, { label: 'Slayd matni' });
      if (error) throw new Error(error);
      return true;
    }),

  body('slides.*.layout')
    .optional()
    .isIn(LAYOUTS)
    .withMessage(`layout ${LAYOUTS.join(', ')} dan biri bo'lishi kerak`),

  body('slides.*.image')
    .custom((value, { req, path }) => {
      const slide = req.body.slides[indexFromPath(path, 'slides')] || {};
      const layout = slide.layout ?? 'text';
      if (value === undefined || value === null || value === '') {
        if (layout !== 'text') throw new Error(`'${layout}' ko'rinishi uchun rasm majburiy`);
        return true;
      }
      if (!isOwnImage(value)) throw new Error(IMAGE_MESSAGE);
      return true;
    }),

  body('slides.*.icon')
    .optional({ values: 'null' })
    .isIn(ICONS)
    .withMessage("Noma'lum ikonka"),

  body('slides.*.theme')
    .optional({ values: 'null' })
    .isIn(THEMES)
    .withMessage(`Mavzu ${THEMES.join(', ')} dan biri bo'lishi kerak`),

  // ─────────────── Mashqlar ───────────────
  body('exercises')
    .optional()
    .isArray({ max: MAX_EXERCISES })
    .withMessage(`exercises massiv bo'lishi kerak (ko'pi bilan ${MAX_EXERCISES} ta)`),

  body('exercises.*.text').custom((value) => {
    const error = checkMarkdown(value, { label: 'Mashq matni', required: true });
    if (error) throw new Error(error);
    return true;
  }),

  body('exercises.*.image')
    .optional({ values: 'null' })
    .custom(isOwnImage)
    .withMessage(IMAGE_MESSAGE),

  body('exercises.*.options').custom((options) => {
    if (!Array.isArray(options) || options.length < 2 || options.length > 4) {
      throw new Error("Variantlar soni 2-4 ta bo'lishi kerak");
    }
    if (!options.every((o) => typeof o === 'string' && o.trim() !== '' && o.trim().length <= 120)) {
      throw new Error("Variantlar bo'sh bo'lmasligi va 120 ta belgidan oshmasligi kerak");
    }
    return true;
  }),

  body('exercises.*.correctIndex')
    .custom((value, { req, path }) => {
      const n = Number(value);
      if (value === null || value === '' || typeof value === 'boolean' || !Number.isInteger(n) || n < 0 || n > 3) {
        throw new Error("correctIndex 0-3 oralig'ida bo'lishi kerak");
      }
      const options = req.body.exercises[indexFromPath(path, 'exercises')]?.options;
      if (n >= (Array.isArray(options) ? options.length : 0)) {
        throw new Error("correctIndex variantlar sonidan kichik bo'lishi kerak");
      }
      return true;
    })
    .toInt(),
];

// Bo'sh dars (slaydlar ham, mashqlar ham yo'q yoki ikkalasi ham bo'sh massiv) — rad etiladi.
// Xato bitta marta, "slides" maydoniga yoziladi.
const notEmptyLesson = body('slides')
  .custom((slides, { req }) => {
    const count = (v) => (Array.isArray(v) ? v.length : 0);
    return count(slides) + count(req.body.exercises) > 0;
  })
  .withMessage("Darsda kamida bitta slayd yoki mashq bo'lishi kerak");

// POST /board-lessons/generate — AI qoralama
const generateBoardLessonValidation = [
  body('topic')
    .isString()
    .withMessage('Mavzu kiritilishi shart')
    .bail()
    .trim()
    .isLength({ min: 3, max: 120 })
    .withMessage("Mavzu 3-120 ta belgi bo'lishi kerak"),

  body('grade')
    .isInt({ min: 1, max: 11 })
    .withMessage("Sinf 1-11 oralig'ida bo'lishi kerak")
    .toInt(),

  body('subject')
    .optional({ values: 'null' })
    .isString()
    .withMessage("Fan nomi matn bo'lishi kerak")
    .bail()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Fan nomi 60 ta belgidan oshmasligi kerak'),

  body('slideCount')
    .isIn([4, 6, 8])
    .withMessage("Slaydlar soni 4, 6 yoki 8 bo'lishi kerak")
    .bail()
    .isInt()
    .withMessage("Slaydlar soni 4, 6 yoki 8 bo'lishi kerak")
    .toInt(),

  body('exerciseCount')
    .isIn([5, 8, 10])
    .withMessage("Mashqlar soni 5, 8 yoki 10 bo'lishi kerak")
    .bail()
    .isInt()
    .withMessage("Mashqlar soni 5, 8 yoki 10 bo'lishi kerak")
    .toInt(),

  body('notes')
    .optional({ values: 'null' })
    .isString()
    .withMessage("Izoh matn bo'lishi kerak")
    .bail()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Izoh 300 ta belgidan oshmasligi kerak'),
];

// POST va PATCH bir xil body qabul qiladi (slides/exercises to'liq almashtiriladi)
const createBoardLessonValidation = [...lessonValidation, notEmptyLesson];
const updateBoardLessonValidation = [...lessonValidation, notEmptyLesson];

module.exports = { createBoardLessonValidation, updateBoardLessonValidation, generateBoardLessonValidation };
