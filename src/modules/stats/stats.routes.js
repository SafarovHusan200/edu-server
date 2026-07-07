// src/modules/stats/stats.routes.js

const express = require('express');
const router = express.Router();

const statsController = require('./stats.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');

// GET /api/v1/stats/teacher
router.get(
  '/teacher',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  statsController.getTeacherStats
);

module.exports = router;
