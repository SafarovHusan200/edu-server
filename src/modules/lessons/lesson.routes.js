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

// GET /api/v1/lessons/:id
router.get('/:id', lessonController.getLessonById);

// PATCH /api/v1/lessons/:id
router.patch('/:id', authenticate, authorize(...TEACHING_ROLES), lessonController.updateLesson);

// DELETE /api/v1/lessons/:id
router.delete('/:id', authenticate, authorize(...TEACHING_ROLES), lessonController.deleteLesson);

// POST /api/v1/lessons/:id/material
router.post(
  '/:id/material',
  authenticate,
  authorize(...TEACHING_ROLES),
  uploadMaterial('lessons').single('material'),
  lessonController.addMaterial
);

// POST /api/v1/lessons/:id/complete
router.post(
  '/:id/complete',
  authenticate,
  authorize('student'),
  lessonController.completeLesson
);

module.exports = router;
