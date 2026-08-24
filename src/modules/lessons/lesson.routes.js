// src/modules/lessons/lesson.routes.js
// Dars yaratish/ro'yxati /courses/:id/lessons ostida (course.routes.js) — bu yerda
// faqat bitta darsga tegishli amallar (id orqali).

const express = require('express');
const router = express.Router();

const lessonController = require('./lesson.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { uploadMaterial } = require('../../middleware/upload');

const TEACHING_ROLES = ['teacher', 'admin', 'superadmin'];

/**
 * @swagger
 * /lessons/{id}:
 *   get:
 *     summary: Darsni ID bo'yicha olish
 *     tags: [Lessons]
 *     security: []
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
 *                     data: { $ref: '#/components/schemas/Lesson' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// GET /api/v1/lessons/:id
router.get('/:id', lessonController.getLessonById);

/**
 * @swagger
 * /lessons/{id}:
 *   patch:
 *     summary: Darsni yangilash
 *     tags: [Lessons]
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
 *               content: { type: string }
 *               videoUrl: { type: string, format: uri }
 *               order: { type: integer, minimum: 0 }
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
 *                     data: { $ref: '#/components/schemas/Lesson' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// PATCH /api/v1/lessons/:id
router.patch('/:id', authenticate, authorize(...TEACHING_ROLES), lessonController.updateLesson);

/**
 * @swagger
 * /lessons/{id}:
 *   delete:
 *     summary: Darsni o'chirish
 *     tags: [Lessons]
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
// DELETE /api/v1/lessons/:id
router.delete('/:id', authenticate, authorize(...TEACHING_ROLES), lessonController.deleteLesson);

/**
 * @swagger
 * /lessons/{id}/material:
 *   post:
 *     summary: Darsga material (fayl) biriktirish
 *     tags: [Lessons]
 *     description: "Ruxsat: teacher, admin, superadmin"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [material]
 *             properties:
 *               material: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Material qo'shildi
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
 */
// POST /api/v1/lessons/:id/material
router.post(
  '/:id/material',
  authenticate,
  authorize(...TEACHING_ROLES),
  uploadMaterial('lessons').single('material'),
  lessonController.addMaterial
);

/**
 * @swagger
 * /lessons/{id}/complete:
 *   post:
 *     summary: Darsni tugatilgan deb belgilash
 *     tags: [Lessons]
 *     description: "Ruxsat: student"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       200:
 *         description: Dars tugatildi deb belgilandi
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
// POST /api/v1/lessons/:id/complete
router.post(
  '/:id/complete',
  authenticate,
  authorize('student'),
  lessonController.completeLesson
);

module.exports = router;
