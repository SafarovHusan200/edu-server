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
 *                         me:
 *                           type: object
 *                           nullable: true
 *                           description: "So'ragan foydalanuvchi teacher bo'lsa va reytingda bo'lsa — o'z o'rni"
 *                           properties:
 *                             rank: { type: integer }
 *                             activityScore: { type: number }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// GET /api/v1/stats/top-teachers — istalgan login qilgan foydalanuvchi ko'ra oladi
router.get('/top-teachers', authenticate, statsController.getTopTeachers);

/**
 * @swagger
 * /stats/admin:
 *   get:
 *     summary: Admin dashboard statistikasi (7 ta alohida so'rov o'rniga bitta chaqiruv)
 *     tags: [Stats]
 *     description: "Ruxsat: admin, superadmin"
 *     responses:
 *       200:
 *         description: Statistika
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
 *                         stats:
 *                           type: object
 *                           properties:
 *                             students: { type: integer }
 *                             teachers: { type: integer }
 *                             pendingUsers: { type: integer, description: "isVerified=false" }
 *                             pendingRedemptions: { type: integer }
 *                             activePremium: { type: integer, description: "tarif='premium' VA muddati hali o'tmagan" }
 *                             paymentsThisMonth:
 *                               type: object
 *                               description: "Joriy kalendar oyi, Toshkent vaqti bo'yicha"
 *                               properties:
 *                                 total: { type: integer, description: 'Tiyinda' }
 *                                 count: { type: integer }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
// GET /api/v1/stats/admin
router.get('/admin', authenticate, authorize('admin', 'superadmin'), statsController.getAdminStats);

/**
 * @swagger
 * /stats/student:
 *   get:
 *     summary: O'quvchi dashboard statistikasi
 *     tags: [Stats]
 *     description: "Ruxsat: login qilgan foydalanuvchi (amalda student uchun mo'ljallangan)"
 *     responses:
 *       200:
 *         description: Statistika
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
 *                         stats:
 *                           type: object
 *                           properties:
 *                             completedLessons: { type: integer }
 *                             certificatesCount: { type: integer }
 *                             rank: { type: integer, nullable: true, description: "Diamond reytingidagi o'rni" }
 *                             activeQuizzesCount: { type: integer, description: "O'z sinfiga mo'ljallangan, faol testlar soni" }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// GET /api/v1/stats/student
router.get('/student', authenticate, statsController.getStudentStats);

module.exports = router;
