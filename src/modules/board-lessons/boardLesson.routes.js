// src/modules/board-lessons/boardLesson.routes.js
// Super-ustoz → Interaktiv dars: doskada ko'rsatiladigan slaydlar + mashqlar to'plami.
// DIQQAT: /lessons (kurs darslari) bilan aloqasi yo'q.

const express = require('express');
const router = express.Router();

const controller = require('./boardLesson.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { uploadImage } = require('../../middleware/upload');
const {
  createBoardLessonValidation,
  updateBoardLessonValidation,
  generateBoardLessonValidation,
} = require('./boardLesson.validation');

router.use(authenticate, authorize('teacher', 'admin', 'superadmin'));

/**
 * @swagger
 * components:
 *   schemas:
 *     BoardLessonSlide:
 *       type: object
 *       description: "title, body yoki image'dan kamida bittasi bo'lishi kerak. layout 'split' yoki 'image' bo'lsa image majburiy."
 *       properties:
 *         title: { type: string, maxLength: 120, default: '' }
 *         body: { type: string, maxLength: 2000, default: '', description: "Markdown. Rasm: ![nom](/uploads/board-lessons/...) — faqat upload-image natijasi, ko'pi bilan 3 ta. Base64, tashqi havola va HTML <img> rad etiladi" }
 *         image: { type: string, nullable: true, description: "POST /board-lessons/upload-image natijasi" }
 *         layout: { type: string, enum: [text, split, image], default: text }
 *         icon: { type: string, nullable: true, enum: [lightbulb, book, star, rocket, atom, flask, calculator, compass, globe, sprout, paw, music, palette, trophy, sparkles] }
 *         theme: { type: string, nullable: true, enum: [ocean, sunset, forest, galaxy, candy, sun], description: "null — darsning umumiy mavzusi" }
 *     BoardLessonExercise:
 *       type: object
 *       required: [text, options, correctIndex]
 *       properties:
 *         text: { type: string, maxLength: 2000, description: "Markdown, ko'pi bilan 3 ta rasm (slayd body bilan bir xil qoidalar)" }
 *         image: { type: string, nullable: true }
 *         options: { type: array, minItems: 2, maxItems: 4, items: { type: string, maxLength: 120 } }
 *         correctIndex: { type: integer, minimum: 0, description: "options.length dan kichik" }
 *     BoardLessonInput:
 *       type: object
 *       required: [title]
 *       description: "slides va exercises ikkalasi ham bo'sh bo'lishi mumkin emas (422, field: slides)"
 *       properties:
 *         title: { type: string, maxLength: 120 }
 *         description: { type: string, nullable: true, maxLength: 500 }
 *         subject: { type: string, nullable: true, maxLength: 60 }
 *         grade: { type: integer, nullable: true, minimum: 1, maximum: 11 }
 *         theme: { type: string, enum: [ocean, sunset, forest, galaxy, candy, sun], default: ocean }
 *         slides: { type: array, maxItems: 50, items: { $ref: '#/components/schemas/BoardLessonSlide' } }
 *         exercises: { type: array, maxItems: 50, items: { $ref: '#/components/schemas/BoardLessonExercise' } }
 *     BoardLessonSummary:
 *       type: object
 *       properties:
 *         _id: { type: string }
 *         title: { type: string }
 *         subject: { type: string, nullable: true }
 *         grade: { type: integer, nullable: true }
 *         theme: { type: string }
 *         coverImage: { type: string, nullable: true, description: "Birinchi rasmli slaydning rasmi" }
 *         slideCount: { type: integer }
 *         exerciseCount: { type: integer }
 *         updatedAt: { type: string, format: date-time }
 *     BoardLesson:
 *       allOf:
 *         - $ref: '#/components/schemas/BoardLessonSummary'
 *         - type: object
 *           properties:
 *             description: { type: string, nullable: true }
 *             slides: { type: array, items: { $ref: '#/components/schemas/BoardLessonSlide' } }
 *             exercises: { type: array, items: { $ref: '#/components/schemas/BoardLessonExercise' } }
 *             createdBy: { type: string }
 *             createdAt: { type: string, format: date-time }
 */

/**
 * @swagger
 * /board-lessons/upload-image:
 *   post:
 *     summary: Slayd yoki mashq uchun rasm yuklash
 *     tags: [BoardLessons]
 *     description: "Ruxsat: teacher, admin, superadmin. Qaytgan `image` yo'lini slayd/mashqning `image` maydoniga yozing yoki markdown matnga `![nom](image)` qilib qo'shing. Base64 ishlatmang. JPG/PNG/WEBP, 5MB gacha."
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image: { type: string, format: binary }
 *     responses:
 *       201: { description: "data: { image: '/uploads/board-lessons/...' }" }
 *       400: { description: "Fayl yuborilmagan yoki ruxsat etilmagan tur" }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
// /:id dan OLDIN ro'yxatdan o'tkazilishi shart
router.post('/upload-image', uploadImage('board-lessons').single('image'), controller.uploadImage);

/**
 * @swagger
 * /board-lessons/generate:
 *   post:
 *     summary: AI orqali dars qoralamasini tuzish (Gemini)
 *     tags: [BoardLessons]
 *     description: >
 *       Ruxsat: teacher, admin, superadmin. Natija BAZAGA SAQLANMAYDI — frontend qoralamani
 *       muharrirda ko'rsatadi, o'qituvchi tahrirlab POST /board-lessons orqali saqlaydi.
 *       Javob serverda tozalanadi: noto'g'ri mashqlar tashlab yuboriladi, shuning uchun
 *       slayd/mashq soni so'ralganidan kam bo'lishi mumkin.
 *       Javob odatda 10–40 soniya, model band bo'lsa 2 daqiqagacha.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [topic, grade, slideCount, exerciseCount]
 *             properties:
 *               topic: { type: string, minLength: 3, maxLength: 120, example: "Oddiy kasrlarni qo'shish" }
 *               grade: { type: integer, minimum: 1, maximum: 11, example: 5 }
 *               subject: { type: string, maxLength: 60, example: Matematika }
 *               slideCount: { type: integer, enum: [4, 6, 8] }
 *               exerciseCount: { type: integer, enum: [5, 8, 10] }
 *               notes: { type: string, maxLength: 300, description: "O'qituvchi istagi (masalan: ko'proq hayotiy misol)" }
 *     responses:
 *       200:
 *         description: Qoralama
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         draft:
 *                           type: object
 *                           properties:
 *                             title: { type: string }
 *                             description: { type: string }
 *                             subject: { type: string, nullable: true }
 *                             grade: { type: integer }
 *                             theme: { type: string, enum: [ocean, sunset, forest, galaxy, candy, sun] }
 *                             slides: { type: array, items: { $ref: '#/components/schemas/BoardLessonSlide' } }
 *                             exercises: { type: array, items: { $ref: '#/components/schemas/BoardLessonExercise' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *       429: { description: "AI provayder limiti tugadi" }
 *       502: { description: "AI javobini o'qib bo'lmadi yoki yaroqli dars qaytmadi" }
 *       503: { description: "AI xizmati sozlanmagan / band / vaqtincha ishlamayapti. Model band bo'lsa server o'zi qayta urinadi (GEMINI_FALLBACK_MODEL berilgan bo'lsa navbat bilan unga), jami 2 daqiqagacha" }
 *       504: { description: "AI 60 soniyada javob bermadi" }
 */
// /:id dan OLDIN ro'yxatdan o'tkazilishi shart
router.post('/generate', generateBoardLessonValidation, validate, controller.generateDraft);

/**
 * @swagger
 * /board-lessons/{id}/duplicate:
 *   post:
 *     summary: Darsdan nusxa olish
 *     tags: [BoardLessons]
 *     description: "Ruxsat: teacher, admin, superadmin. Ko'rish huquqi bor (o'z darsi yoki admin/superadmin uchun istalgan) darsdan joriy foydalanuvchi nomiga mustaqil nusxa yaratiladi. Nomi: \"<title> (nusxa)\" (120 belgidan oshsa asl nom qirqiladi)."
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       201:
 *         description: Nusxa yaratildi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         lesson: { $ref: '#/components/schemas/BoardLesson' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.post('/:id/duplicate', controller.duplicateLesson);

/**
 * @swagger
 * /board-lessons:
 *   get:
 *     summary: Interaktiv darslar ro'yxati
 *     tags: [BoardLessons]
 *     description: "Ruxsat: teacher, admin, superadmin. Odatda faqat o'z darslari; admin/superadmin `all=true` bilan hammaning darslarini ko'radi. slides/exercises massivlari qaytarilmaydi — faqat slideCount/exerciseCount. Tartib: updatedAt kamayish bo'yicha."
 *     parameters:
 *       - { name: search, in: query, schema: { type: string }, description: "Nomi bo'yicha qidiruv" }
 *       - { name: grade, in: query, schema: { type: integer, minimum: 1, maximum: 11 } }
 *       - { name: all, in: query, schema: { type: boolean }, description: "Faqat admin/superadmin uchun" }
 *       - { name: page, in: query, schema: { type: integer, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, default: 10 } }
 *     responses:
 *       200:
 *         description: Ro'yxat
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         lessons: { type: array, items: { $ref: '#/components/schemas/BoardLessonSummary' } }
 *                         meta:
 *                           type: object
 *                           properties:
 *                             total: { type: integer }
 *                             page: { type: integer }
 *                             limit: { type: integer }
 *                             totalPages: { type: integer }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *   post:
 *     summary: Interaktiv dars yaratish
 *     tags: [BoardLessons]
 *     description: "Ruxsat: teacher, admin, superadmin. Validatsiya xatolarida field nomlari `slides[2].image`, `exercises[0].options`, `title` ko'rinishida bo'ladi."
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/BoardLessonInput' }
 *     responses:
 *       201:
 *         description: Yaratildi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         lesson: { $ref: '#/components/schemas/BoardLesson' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.get('/', controller.getLessons);
router.post('/', createBoardLessonValidation, validate, controller.createLesson);

/**
 * @swagger
 * /board-lessons/{id}:
 *   get:
 *     summary: Darsni to'liq olish (muharrir va doska uchun)
 *     tags: [BoardLessons]
 *     description: "Ruxsat: darsning egasi, admin, superadmin"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       200:
 *         description: Dars
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         lesson: { $ref: '#/components/schemas/BoardLesson' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   patch:
 *     summary: Darsni tahrirlash
 *     tags: [BoardLessons]
 *     description: "Ruxsat: darsning egasi, admin, superadmin. Body POST bilan bir xil — slides va exercises TO'LIQ almashtiriladi."
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/BoardLessonInput' }
 *     responses:
 *       200: { description: "data: { lesson }" }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *   delete:
 *     summary: Darsni o'chirish
 *     tags: [BoardLessons]
 *     description: "Ruxsat: darsning egasi, admin, superadmin. Yuklangan rasmlar o'chirilmaydi."
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       200:
 *         description: O'chirildi
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', controller.getLessonById);
router.patch('/:id', updateBoardLessonValidation, validate, controller.updateLesson);
router.delete('/:id', controller.deleteLesson);

module.exports = router;
