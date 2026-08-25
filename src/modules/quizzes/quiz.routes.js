// src/modules/quizzes/quiz.routes.js

const express = require('express');
const router = express.Router();

const quizController = require('./quiz.controller');
const attemptController = require('../quiz-attempts/quizAttempt.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { quizValidation, questionValidation, submitValidation } = require('./quiz.validation');
const validate = require('../../middleware/validate');

// ───────────────────────────────────────────────────────
// QUIZ CRUD
// ───────────────────────────────────────────────────────

/**
 * @swagger
 * /quizzes:
 *   get:
 *     summary: Barcha testlarni olish
 *     tags: [Quizzes]
 *     security: []
 *     parameters:
 *       - { name: grade, in: query, schema: { type: integer, minimum: 1, maximum: 11 } }
 *       - { name: targetType, in: query, schema: { type: string, enum: [course, lesson, standalone] } }
 *     responses:
 *       200:
 *         description: Testlar ro'yxati
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Quiz' }
 */
// Barcha quizlar (public)
router.get('/', quizController.getQuizzes);

/**
 * @swagger
 * /quizzes/my:
 *   get:
 *     summary: O'qituvchining o'zi yaratgan testlari
 *     tags: [Quizzes]
 *     description: "Ruxsat: login qilingan foydalanuvchi (odatda teacher/admin/superadmin)"
 *     parameters:
 *       - { name: targetType, in: query, schema: { type: string, enum: [course, lesson, standalone] } }
 *       - { name: targetId, in: query, schema: { type: string } }
 *       - { name: page, in: query, schema: { type: integer, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, default: 10 } }
 *     responses:
 *       200:
 *         description: Testlar ro'yxati (har birida questionsCount bilan)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         allOf:
 *                           - $ref: '#/components/schemas/Quiz'
 *                           - type: object
 *                             properties:
 *                               questionsCount: { type: integer }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// O'qituvchining o'z testlari
router.get('/my', authenticate, quizController.getQuizzesMy);

/**
 * @swagger
 * /quizzes/{id}:
 *   get:
 *     summary: Testni ID bo'yicha olish (savollar to'g'ri javobsiz)
 *     tags: [Quizzes]
 *     security: []
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       200:
 *         description: Test
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Quiz' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// Quiz — student (javoblarsiz)
router.get('/:id', quizController.getQuizById);

/**
 * @swagger
 * /quizzes/{id}/answers:
 *   get:
 *     summary: Testni to'g'ri javoblari bilan olish
 *     tags: [Quizzes]
 *     description: "Ruxsat: teacher, admin, superadmin"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       200:
 *         description: Test (javoblar bilan)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Quiz' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// Quiz — teacher/admin (javoblar bilan)
router.get(
  '/:id/answers',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  quizController.getQuizByIdWithAnswers
);

/**
 * @swagger
 * /quizzes:
 *   post:
 *     summary: Yangi test yaratish
 *     tags: [Quizzes]
 *     description: "Ruxsat: teacher, admin, superadmin"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, targetType, timeLimit, grade]
 *             properties:
 *               title: { type: string, minLength: 3, maxLength: 100 }
 *               targetType: { type: string, enum: [course, lesson, standalone] }
 *               targetId: { type: string, description: "targetType='course' yoki 'lesson' bo'lsa majburiy" }
 *               passingScore: { type: integer, minimum: 0, maximum: 100, default: 60 }
 *               maxAttempts: { type: integer, minimum: 1, default: 3 }
 *               timeLimit: { type: integer, minimum: 1, description: 'Daqiqada' }
 *               grade: { type: integer, minimum: 1, maximum: 11 }
 *               availableFrom: { type: string, format: date-time }
 *               availableUntil: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Yaratildi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Quiz' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
// Quiz yaratish
router.post(
  '/',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  quizValidation,
  validate,
  quizController.createQuiz
);

/**
 * @swagger
 * /quizzes/{id}:
 *   patch:
 *     summary: Testni yangilash (isActive shu orqali ham o'zgaradi)
 *     tags: [Quizzes]
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
 *               passingScore: { type: integer, minimum: 0, maximum: 100 }
 *               maxAttempts: { type: integer, minimum: 1 }
 *               timeLimit: { type: integer, minimum: 1 }
 *               availableFrom: { type: string, format: date-time }
 *               availableUntil: { type: string, format: date-time }
 *               isActive: { type: boolean }
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
 *                     data: { $ref: '#/components/schemas/Quiz' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// Quiz yangilash
router.patch(
  '/:id',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  quizController.updateQuiz
);

/**
 * @swagger
 * /quizzes/{id}:
 *   delete:
 *     summary: Testni o'chirish
 *     tags: [Quizzes]
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
// Quiz o'chirish
router.delete(
  '/:id',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  quizController.deleteQuiz
);

// ───────────────────────────────────────────────────────
// QUESTIONS
// ───────────────────────────────────────────────────────

/**
 * @swagger
 * /quizzes/{id}/questions:
 *   post:
 *     summary: Testga savol qo'shish
 *     tags: [Quizzes]
 *     description: "Ruxsat: teacher, admin, superadmin"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text, type]
 *             properties:
 *               text: { type: string }
 *               type: { type: string, enum: [multiple_choice, true_false, open_ended] }
 *               options:
 *                 type: array
 *                 description: "type='multiple_choice' uchun, kamida 2 ta"
 *                 items: { $ref: '#/components/schemas/QuestionOption' }
 *               correctAnswer:
 *                 description: "multiple_choice/true_false uchun majburiy"
 *                 nullable: true
 *               sampleAnswer: { type: string, maxLength: 1000, description: "type='open_ended' uchun ixtiyoriy" }
 *               points: { type: integer, minimum: 1, default: 1 }
 *     responses:
 *       201:
 *         description: Savol qo'shildi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Question' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  '/:id/questions',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  questionValidation,
  validate,
  quizController.addQuestion
);

/**
 * @swagger
 * /quizzes/questions/{questionId}:
 *   patch:
 *     summary: Savolni yangilash
 *     tags: [Quizzes]
 *     description: "Ruxsat: teacher, admin, superadmin"
 *     parameters:
 *       - { name: questionId, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text: { type: string }
 *               options:
 *                 type: array
 *                 items: { $ref: '#/components/schemas/QuestionOption' }
 *               correctAnswer: { nullable: true }
 *               sampleAnswer: { type: string }
 *               points: { type: integer, minimum: 1 }
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
 *                     data: { $ref: '#/components/schemas/Question' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch(
  '/questions/:questionId',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  quizController.updateQuestion
);

/**
 * @swagger
 * /quizzes/questions/{questionId}:
 *   delete:
 *     summary: Savolni o'chirish
 *     tags: [Quizzes]
 *     description: "Ruxsat: teacher, admin, superadmin"
 *     parameters:
 *       - { name: questionId, in: path, required: true, schema: { type: string } }
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
router.delete(
  '/questions/:questionId',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  quizController.deleteQuestion
);

// ───────────────────────────────────────────────────────
// ATTEMPTS
// ───────────────────────────────────────────────────────

/**
 * @swagger
 * /quizzes/{quizId}/start:
 *   post:
 *     summary: Testni boshlash (yangi urinish yaratadi)
 *     tags: [Quizzes]
 *     description: "Ruxsat: student"
 *     parameters:
 *       - { name: quizId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       201:
 *         description: Urinish boshlandi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/QuizAttempt' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
// Boshlash
router.post('/:quizId/start', authenticate, authorize('student'), attemptController.startAttempt);

/**
 * @swagger
 * /quizzes/attempts/{attemptId}/submit:
 *   post:
 *     summary: Urinish javoblarini yuborish
 *     tags: [Quizzes]
 *     description: "Ruxsat: student"
 *     parameters:
 *       - { name: attemptId, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [answers]
 *             properties:
 *               answers:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [questionId, givenAnswer]
 *                   properties:
 *                     questionId: { type: string }
 *                     givenAnswer:
 *                       description: "multiple_choice → variant indeksi, true_false → true/false, open_ended → matn"
 *     responses:
 *       200:
 *         description: Javoblar yuborildi, natija hisoblandi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/QuizAttempt' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
// Yuborish
router.post(
  '/attempts/:attemptId/submit',
  authenticate,
  authorize('student'),
  submitValidation,
  validate,
  attemptController.submitAttempt
);

/**
 * @swagger
 * /quizzes/{quizId}/my-attempts:
 *   get:
 *     summary: O'zining shu testdagi urinishlarini olish
 *     tags: [Quizzes]
 *     parameters:
 *       - { name: quizId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Urinishlar ro'yxati
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/QuizAttempt' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// O'z natijalari
router.get('/:quizId/my-attempts', authenticate, attemptController.getMyAttempts);

/**
 * @swagger
 * /quizzes/{quizId}/results:
 *   get:
 *     summary: Testning barcha o'quvchilar natijalarini olish
 *     tags: [Quizzes]
 *     description: "Ruxsat: teacher, admin, superadmin"
 *     parameters:
 *       - { name: quizId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Natijalar ro'yxati
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/QuizAttempt' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
// Barcha natijalar (teacher/admin)
router.get(
  '/:quizId/results',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  attemptController.getQuizResults
);

/**
 * @swagger
 * /quizzes/attempts/{attemptId}/review:
 *   patch:
 *     summary: Open-ended javoblarni baholash
 *     tags: [Quizzes]
 *     description: "Ruxsat: teacher, admin, superadmin"
 *     parameters:
 *       - { name: attemptId, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reviews:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     questionId: { type: string }
 *                     pointsEarned: { type: number }
 *                     feedback: { type: string }
 *     responses:
 *       200:
 *         description: Baholandi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/QuizAttempt' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// Open ended tekshirish (teacher)
router.patch(
  '/attempts/:attemptId/review',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  attemptController.reviewOpenEnded
);

module.exports = router;
