// src/routes/index.js

const express = require('express');
const router = express.Router();

const authRoutes = require('../modules/auth/auth.routes');
// keyingi modullar shu yerga qo'shiladi:
// const courseRoutes = require('../modules/courses/course.routes');
const quizRoutes = require('../modules/quizzes/quiz.routes');
const paymentRoutes = require('../modules/payment/payment.routes');

router.use('/auth', authRoutes);
router.use('/quizzes', quizRoutes);
router.use('/payment', paymentRoutes);
// router.use('/courses', courseRoutes);

module.exports = router;
