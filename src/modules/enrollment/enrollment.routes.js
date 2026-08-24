// src/modules/enrollment/enrollment.routes.js

const express = require('express');
const router = express.Router();

const enrollmentController = require('./enrollment.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');

router.use(authenticate);

/**
 * @swagger
 * /enrollment:
 *   post:
 *     summary: Kursga yozilish (bepul kurslar uchun, pullik kurslar to'lov orqali)
 *     tags: [Enrollment]
 *     description: "Ruxsat: student"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [courseId]
 *             properties:
 *               courseId: { type: string, description: 'Course ObjectId' }
 *     responses:
 *       201:
 *         description: Kursga yozildi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Enrollment' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
// POST /api/v1/enrollment  { courseId }
router.post('/', authorize('student'), enrollmentController.enroll);

/**
 * @swagger
 * /enrollment/my:
 *   get:
 *     summary: O'zining barcha kursga yozilishlarini olish
 *     tags: [Enrollment]
 *     responses:
 *       200:
 *         description: Yozilishlar ro'yxati
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Enrollment' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// GET /api/v1/enrollment/my
router.get('/my', enrollmentController.getMyEnrollments);

/**
 * @swagger
 * /enrollment/{id}:
 *   get:
 *     summary: Yozilishni ID bo'yicha olish
 *     tags: [Enrollment]
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       200:
 *         description: Yozilish
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Enrollment' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// GET /api/v1/enrollment/:id
router.get('/:id', enrollmentController.getEnrollmentById);

module.exports = router;
