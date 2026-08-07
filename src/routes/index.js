// src/routes/index.js

const express = require('express');
const router = express.Router();

const authRoutes = require('../modules/auth/auth.routes');
const userRoutes = require('../modules/users/user.routes');
const categoryRoutes = require('../modules/categories/category.routes');
const bookCategoryRoutes = require('../modules/book-categories/bookCategory.routes');
const bookRoutes = require('../modules/books/book.routes');
const courseRoutes = require('../modules/courses/course.routes');
const lessonRoutes = require('../modules/lessons/lesson.routes');
const enrollmentRoutes = require('../modules/enrollment/enrollment.routes');
const reviewRoutes = require('../modules/reviews/review.routes');
const notificationRoutes = require('../modules/notifications/notification.routes');
const quizRoutes = require('../modules/quizzes/quiz.routes');
const paymentRoutes = require('../modules/payment/payment.routes');
const rewardRoutes = require('../modules/rewards/reward.routes');
const certificateRoutes = require('../modules/certificates/certificate.routes');
const statsRoutes = require('../modules/stats/stats.routes');
const promoCodeRoutes = require('../modules/promocodes/promocode.routes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/categories', categoryRoutes);
router.use('/book-categories', bookCategoryRoutes);
router.use('/books', bookRoutes);
router.use('/courses', courseRoutes);
router.use('/lessons', lessonRoutes);
router.use('/enrollment', enrollmentRoutes);
router.use('/reviews', reviewRoutes);
router.use('/notifications', notificationRoutes);
router.use('/quizzes', quizRoutes);
router.use('/payment', paymentRoutes);
router.use('/rewards', rewardRoutes);
router.use('/certificates', certificateRoutes);
router.use('/stats', statsRoutes);
router.use('/promo-codes', promoCodeRoutes);

module.exports = router;
