// src/modules/stats/stats.routes.js

const express = require('express');
const router = express.Router();

const statsController = require('./stats.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');

/**
 * @swagger
 * /stats/teacher:
 *   get:
 *     summary: O'qituvchi statistikasini olish (kurslar, o'quvchilar, daromad)
 *     tags: [Stats]
 *     description: "Ruxsat: teacher, admin, superadmin"
 *     responses:
 *       200:
 *         description: Statistika
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
// GET /api/v1/stats/teacher
router.get(
  '/teacher',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  statsController.getTeacherStats
);

/**
 * @swagger
 * /stats/top-teachers:
 *   get:
 *     summary: Eng faol o'qituvchilar reytingi (kurs/test/dars/kitob soniga qarab)
 *     tags: [Stats]
 *     parameters:
 *       - { name: page, in: query, schema: { type: integer, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, default: 10 } }
 *     responses:
 *       200:
 *         description: Reyting ro'yxati
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
 *                         teachers:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               rank: { type: integer }
 *                               _id: { type: string }
 *                               name: { type: string }
 *                               avatar: { type: string, nullable: true }
 *                               coursesCount: { type: integer }
 *                               quizzesCount: { type: integer }
 *                               lessonsCount: { type: integer }
 *                               booksCount: { type: integer }
 *                               studentsCount: { type: integer, description: "Noyob o'quvchilar soni" }
 *                               avgRating: { type: number }
 *                               activityScore: { type: number, description: "Saralash shu bo'yicha amalga oshadi" }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// GET /api/v1/stats/top-teachers — istalgan login qilgan foydalanuvchi ko'ra oladi
router.get('/top-teachers', authenticate, statsController.getTopTeachers);

module.exports = router;
