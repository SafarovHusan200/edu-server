// src/modules/enrollment/enrollment.routes.js

const express = require('express');
const router = express.Router();

const enrollmentController = require('./enrollment.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');

router.use(authenticate);

// POST /api/v1/enrollment  { courseId }
router.post('/', authorize('student'), enrollmentController.enroll);

// GET /api/v1/enrollment/my
router.get('/my', enrollmentController.getMyEnrollments);

// GET /api/v1/enrollment/:id
router.get('/:id', enrollmentController.getEnrollmentById);

module.exports = router;
