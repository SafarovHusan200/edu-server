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

module.exports = router;
