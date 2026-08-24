// src/modules/courses/course.routes.js

const express = require('express');
const router = express.Router();

const courseController = require('./course.controller');
const lessonController = require('../lessons/lesson.controller');
const reviewController = require('../reviews/review.controller');

const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { uploadImage } = require('../../middleware/upload');

const { courseValidation } = require('./course.validation');
const { lessonValidation } = require('../lessons/lesson.validation');
const { reviewValidation } = require('../reviews/review.validation');

const TEACHING_ROLES = ['teacher', 'admin', 'superadmin'];

// ───────────────────────────────────────────────────────
// COURSE CRUD
// ───────────────────────────────────────────────────────

/**
 * @swagger
 * /courses:
 *   get:
 *     summary: Kurslar ro'yxatini olish
 *     tags: [Courses]
 *     security: []
 *     description: "Login qilingan bo'lsa (ixtiyoriy token) o'zining draft kurslari ham ko'rinadi"
 *     parameters:
 *       - { name: category, in: query, schema: { type: string } }
 *       - { name: search, in: query, schema: { type: string } }
 *       - { name: page, in: query, schema: { type: integer, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, default: 10 } }
 *     responses:
 *       200:
 *         description: Kurslar ro'yxati
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Course' }
 */
// GET /api/v1/courses — public (login bo'lsa o'zining draft kurslari ham ko'rinadi)
router.get('/', authenticate.optional, courseController.getCourses);

/**
 * @swagger
 * /courses/{id}:
 *   get:
 *     summary: Kursni ID bo'yicha olish
 *     tags: [Courses]
 *     security: []
 *     description: "Login qilingan bo'lsa to'liq kontent (masalan enrollment holati) aniqlanadi"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       200:
 *         description: Kurs
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Course' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// GET /api/v1/courses/:id — public (login bo'lsa to'liq kontent aniqlanadi)
router.get('/:id', authenticate.optional, courseController.getCourseById);

/**
 * @swagger
 * /courses:
 *   post:
 *     summary: Yangi kurs yaratish
 *     tags: [Courses]
 *     description: "Ruxsat: teacher, admin, superadmin"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, category]
 *             properties:
 *               title: { type: string, minLength: 3, maxLength: 120 }
 *               description: { type: string, maxLength: 2000 }
 *               category: { type: string, description: 'Category ObjectId' }
 *               price: { type: integer, minimum: 0, description: "Tiyinda, 0 = bepul" }
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
 *                     data: { $ref: '#/components/schemas/Course' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
// POST /api/v1/courses
router.post(
  '/',
  authenticate,
  authorize(...TEACHING_ROLES),
  courseValidation,
  validate,
  courseController.createCourse
);

/**
 * @swagger
 * /courses/{id}:
 *   patch:
 *     summary: Kursni yangilash (isPublished shu orqali ham o'zgaradi)
 *     tags: [Courses]
 *     description: "Ruxsat: teacher, admin, superadmin"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               category: { type: string }
 *               price: { type: integer, minimum: 0 }
 *               isPublished: { type: boolean }
 *     responses:
 *       200:
 *         description: Yangilandi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Course' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// PATCH /api/v1/courses/:id
router.patch('/:id', authenticate, authorize(...TEACHING_ROLES), courseController.updateCourse);

/**
 * @swagger
 * /courses/{id}:
 *   delete:
 *     summary: Kursni o'chirish
 *     tags: [Courses]
 *     description: "Ruxsat: teacher, admin, superadmin"
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
// DELETE /api/v1/courses/:id
router.delete('/:id', authenticate, authorize(...TEACHING_ROLES), courseController.deleteCourse);

/**
 * @swagger
 * /courses/{id}/thumbnail:
 *   post:
 *     summary: Kurs muqova rasmini yuklash
 *     tags: [Courses]
 *     description: "Ruxsat: teacher, admin, superadmin"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [thumbnail]
 *             properties:
 *               thumbnail: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Rasm yuklandi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Course' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
// POST /api/v1/courses/:id/thumbnail
router.post(
  '/:id/thumbnail',
  authenticate,
  authorize(...TEACHING_ROLES),
  uploadImage('courses').single('thumbnail'),
  courseController.uploadThumbnail
);

/**
 * @swagger
 * /courses/{id}/stats:
 *   get:
 *     summary: Kurs statistikasini olish (yozilganlar soni, daromad va h.k.)
 *     tags: [Courses]
 *     description: "Ruxsat: teacher, admin, superadmin"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       200:
 *         description: Statistika
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
// GET /api/v1/courses/:id/stats
router.get('/:id/stats', authenticate, authorize(...TEACHING_ROLES), courseController.getCourseStats);

// ───────────────────────────────────────────────────────
// NESTED: LESSONS
// ───────────────────────────────────────────────────────

/**
 * @swagger
 * /courses/{id}/lessons:
 *   get:
 *     summary: Kursga tegishli barcha darslarni olish
 *     tags: [Courses]
 *     security: []
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       200:
 *         description: Darslar ro'yxati
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Lesson' }
 */
// GET /api/v1/courses/:id/lessons
router.get('/:id/lessons', lessonController.getLessonsByCourse);

/**
 * @swagger
 * /courses/{id}/lessons:
 *   post:
 *     summary: Kursga yangi dars qo'shish
 *     tags: [Courses]
 *     description: "Ruxsat: teacher, admin, superadmin"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string, minLength: 3, maxLength: 120 }
 *               description: { type: string, maxLength: 1000 }
 *               content: { type: string }
 *               videoUrl: { type: string, format: uri }
 *               order: { type: integer, minimum: 0 }
 *     responses:
 *       201:
 *         description: Dars yaratildi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Lesson' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
// POST /api/v1/courses/:id/lessons
router.post(
  '/:id/lessons',
  authenticate,
  authorize(...TEACHING_ROLES),
  lessonValidation,
  validate,
  lessonController.createLesson
);

// ───────────────────────────────────────────────────────
// NESTED: REVIEWS
// ───────────────────────────────────────────────────────

/**
 * @swagger
 * /courses/{id}/reviews:
 *   get:
 *     summary: Kursga tegishli barcha sharhlarni olish
 *     tags: [Courses]
 *     security: []
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       200:
 *         description: Sharhlar ro'yxati
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Review' }
 */
// GET /api/v1/courses/:id/reviews
router.get('/:id/reviews', reviewController.getReviewsByCourse);

/**
 * @swagger
 * /courses/{id}/reviews:
 *   post:
 *     summary: Kursga sharh qoldirish
 *     tags: [Courses]
 *     description: "Ruxsat: student"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               comment: { type: string, maxLength: 1000 }
 *     responses:
 *       201:
 *         description: Sharh qoldirildi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Review' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
// POST /api/v1/courses/:id/reviews
router.post(
  '/:id/reviews',
  authenticate,
  authorize('student'),
  reviewValidation,
  validate,
  reviewController.createReview
);

module.exports = router;
