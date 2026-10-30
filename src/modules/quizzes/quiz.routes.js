// src/modules/quizzes/quiz.routes.js

const express = require('express');
const router = express.Router();

const quizController = require('./quiz.controller');
const attemptController = require('../quiz-attempts/quizAttempt.controller');
const quizShareController = require('./quizShare.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const {
  quizValidation,
  questionValidation,
  submitValidation,
  shareQuizValidation,
} = require('./quiz.validation');
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
 *     description: >
 *       Har bir quizda endi doim `questionsCount` keladi. Login qilgan student uchun
 *       qo'shimcha `myAttempts: {attemptsUsed, attemptsRemaining, maxAttempts,
 *       bestScorePercent, hasInProgress, lastStatus}` ham qaytadi — avval buning uchun
 *       har bir quiz uchun alohida `GET /quizzes/:quizId/my-attempts` chaqirilardi.
 *     parameters:
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
 *                       items:
 *                         allOf:
 *                           - $ref: '#/components/schemas/Quiz'
 *                           - type: object
 *                             properties:
 *                               questionsCount: { type: integer }
 *                               myAttempts:
 *                                 type: object
 *                                 nullable: true
 *                                 description: "Faqat login qilgan student uchun"
 *                                 properties:
 *                                   attemptsUsed: { type: integer }
 *                                   attemptsRemaining: { type: integer }
 *                                   maxAttempts: { type: integer }
 *                                   bestScorePercent: { type: integer, nullable: true }
 *                                   hasInProgress: { type: boolean }
 *                                   lastStatus: { type: string, nullable: true, enum: [in_progress, submitted, reviewed, expired] }
 */
// Barcha quizlar (public, lekin login bo'lsa student uchun myAttempts qo'shiladi)
router.get('/', authenticate.optional, quizController.getQuizzes);

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
 *         description: Testlar ro'yxati (har birida questionsCount va stats bilan)
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
 *                               stats:
 *                                 type: object
 *                                 properties:
 *                                   attemptsCount: { type: integer }
 *                                   avgScorePercent: { type: integer }
 *                                   passRate: { type: integer }
 *                                   pendingReviews: { type: integer }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// O'qituvchining o'z testlari
router.get('/my', authenticate, quizController.getQuizzesMy);

/**
 * @swagger
 * /quizzes/pending-reviews:
 *   get:
 *     summary: Ochiq savolli, hali tekshirilmagan urinishlar navbati
 *     tags: [Quizzes]
 *     description: >
 *       Ruxsat: teacher (faqat o'z testlari), admin/superadmin (hammasi). Avval oxirgi
 *       N ta faol testning har biri uchun alohida GET /quizzes/{id}/results chaqirilib,
 *       status='submitted' bo'lganlar yig'ilardi — endi bitta so'rov. Eng eski
 *       submittedAt birinchi (navbat tartibida).
 *     parameters:
 *       - { name: quizId, in: query, schema: { type: string }, description: 'Faqat bitta test uchun' }
 *       - { name: page, in: query, schema: { type: integer, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, default: 10 } }
 *     responses:
 *       200:
 *         description: Navbat
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
 *                         items:
 *                           type: array
 *                           items:
 *                             allOf:
 *                               - $ref: '#/components/schemas/QuizAttempt'
 *                               - type: object
 *                                 properties:
 *                                   student:
 *                                     type: object
 *                                     properties:
 *                                       _id: { type: string }
 *                                       name: { type: string }
 *                                       grade: { type: object }
 *                                       avatar: { type: string, nullable: true }
 *                                   quiz:
 *                                     type: object
 *                                     properties:
 *                                       _id: { type: string }
 *                                       title: { type: string }
 *                         total: { type: integer }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { description: "Teacher boshqasining testini quizId bilan so'rasa" }
 */
// GET /api/v1/quizzes/pending-reviews — /:id dan OLDIN ro'yxatdan o'tkazilishi shart
router.get(
  '/pending-reviews',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  attemptController.getPendingReviews
);

/**
 * @swagger
 * /quizzes/pending-reviews/count:
 *   get:
 *     summary: Tekshirish navbatidagi urinishlar soni (menyu son belgisi uchun)
 *     tags: [Quizzes]
 *     description: "Ruxsat: teacher (faqat o'z testlari), admin/superadmin (hammasi)"
 *     responses:
 *       200:
 *         description: Son
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
 *                         count: { type: integer }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// GET /api/v1/quizzes/pending-reviews/count
router.get(
  '/pending-reviews/count',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  attemptController.getPendingReviewsCount
);

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
 *             required: [title, targetType, timeLimit, targetGrades]
 *             properties:
 *               title: { type: string, minLength: 3, maxLength: 100 }
 *               targetType: { type: string, enum: [course, lesson, standalone] }
 *               targetId: { type: string, description: "targetType='course' yoki 'lesson' bo'lsa majburiy" }
 *               passingScore: { type: integer, minimum: 0, maximum: 100, default: 60 }
 *               maxAttempts: { type: integer, minimum: 1, default: 3 }
 *               timeLimit: { type: integer, minimum: 1, description: 'Daqiqada' }
 *               targetGrades:
 *                 type: array
 *                 minItems: 1
 *                 description: "Quiz yechishi mumkin bo'lgan sinflar (bir nechtasi bo'lishi mumkin, masalan 3-A, 3-B, 4-A)"
 *                 items:
 *                   type: object
 *                   required: [number]
 *                   properties:
 *                     number: { type: integer, minimum: 1, maximum: 11, example: 3 }
 *                     letter: { type: string, enum: [A, B, C, D, E], nullable: true, description: "Bo'sh qoldirilsa — shu raqamdagi barcha parallel sinflar" }
 *                     availableFrom: { type: string, format: date-time, description: "Shu sinf uchun alohida boshlanish vaqti (ixtiyoriy — berilmasa quiz darajasidagi umumiy availableFrom ishlaydi)" }
 *                     availableUntil: { type: string, format: date-time, description: "Shu sinf uchun alohida tugash vaqti (ixtiyoriy)" }
 *                     maxAttempts: { type: integer, minimum: 1, description: "Shu sinf uchun alohida urinishlar soni (ixtiyoriy — berilmasa quiz.maxAttempts ishlaydi)" }
 *                     timeLimit: { type: integer, minimum: 1, description: "Shu sinf uchun alohida ishlash vaqti, daqiqada (ixtiyoriy — berilmasa quiz.timeLimit ishlaydi)" }
 *               availableFrom: { type: string, format: date-time, description: "Barcha sinflar uchun umumiy standart oraliq (targetGrades'da alohida ko'rsatilmagan bo'lsa ishlatiladi)" }
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
 *       403: { description: "Rol 'student' emas, yoki bu test studentning sinfi uchun mo'ljallanmagan (targetGrades'da yo'q)" }
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

/**
 * @swagger
 * /quizzes/attempts/{attemptId}:
 *   get:
 *     summary: Bitta urinishni to'liq (savol-javob) ko'rish
 *     tags: [Quizzes]
 *     description: "Ruxsat: urinish egasi (student) yoki teacher/admin/superadmin"
 *     parameters:
 *       - { name: attemptId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Urinish ma'lumotlari
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
 *                         attempt: { $ref: '#/components/schemas/QuizAttempt' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/attempts/:attemptId', authenticate, attemptController.getAttemptById);

/**
 * @swagger
 * /quizzes/attempts/{attemptId}:
 *   delete:
 *     summary: Urinishni o'chirish (test xato ketgan/noto'g'ri ishlangan holatlar uchun)
 *     tags: [Quizzes]
 *     description: >
 *       Ruxsat: superadmin. O'chirilgan urinish maxAttempts hisobidan chiqib ketadi
 *       (student qayta urinib ko'rishi mumkin bo'ladi). Agar shu urinish uchun
 *       diamond berilgan bo'lsa, studentdan avtomatik qaytarib olinadi.
 *     parameters:
 *       - { name: attemptId, in: path, required: true, schema: { type: string } }
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
  '/attempts/:attemptId',
  authenticate,
  authorize('superadmin'),
  attemptController.deleteAttempt
);

// ───────────────────────────────────────────────────────
// QUIZ SHARING — bir o'qituvchi testini boshqasiga ulashishi (nusxa orqali)
// /:id dan OLDIN emas, chunki bular /shares/... (2 segment) — /:id (1 segment)
// bilan to'qnashmaydi, lekin aniqlik uchun /:id/share alohida pastda joylashgan
// ───────────────────────────────────────────────────────

/**
 * @swagger
 * /quizzes/{id}/share:
 *   post:
 *     summary: Testni boshqa o'qituvchiga ulashish (telefon raqami orqali)
 *     tags: [Quizzes]
 *     description: "Ruxsat: testning egasi. Faqat 'standalone' testlar ulashiladi."
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [toTeacherPhone]
 *             properties:
 *               toTeacherPhone: { type: string, example: '+998901234567' }
 *     responses:
 *       201:
 *         description: Ulashildi (so'rov 'pending' holatida yaratildi)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       400: { description: "Standalone bo'lmagan test, o'zingizga ulashish, yoki allaqachon kutilayotgan so'rov bor" }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { description: "Siz bu testning egasi emassiz" }
 *       404: { description: "Quiz yoki shu telefon raqamli o'qituvchi topilmadi" }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post(
  '/:id/share',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  shareQuizValidation,
  validate,
  quizShareController.shareQuiz
);

/**
 * @swagger
 * /quizzes/shares/incoming:
 *   get:
 *     summary: Menga ulashilgan testlar ro'yxati
 *     tags: [Quizzes]
 *     description: "Ruxsat: teacher, admin, superadmin"
 *     parameters:
 *       - { name: status, in: query, schema: { type: string, enum: [pending, accepted, rejected] } }
 *     responses:
 *       200:
 *         description: Ro'yxat
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get(
  '/shares/incoming',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  quizShareController.getIncomingShares
);

/**
 * @swagger
 * /quizzes/shares/outgoing:
 *   get:
 *     summary: Men ulashgan testlar ro'yxati
 *     tags: [Quizzes]
 *     description: "Ruxsat: teacher, admin, superadmin"
 *     parameters:
 *       - { name: status, in: query, schema: { type: string, enum: [pending, accepted, rejected] } }
 *     responses:
 *       200:
 *         description: Ro'yxat
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get(
  '/shares/outgoing',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  quizShareController.getOutgoingShares
);

/**
 * @swagger
 * /quizzes/shares/{id}/accept:
 *   patch:
 *     summary: Ulashilgan testni qabul qilish (mustaqil nusxa yaratiladi)
 *     tags: [Quizzes]
 *     description: "Ruxsat: qabul qiluvchi o'qituvchi. Faqat 'pending' holatidan chaqiriladi."
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       200:
 *         description: Qabul qilindi, yangi (mustaqil) quiz yaratildi — isActive=false, targetGrades'ni o'z sinfingizga moslab PATCH /quizzes/{clonedQuizId} orqali sozlang
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       400: { description: "So'rov allaqachon javob berilgan" }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { description: "Bu sizga ulashilgan so'rov emas" }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch(
  '/shares/:id/accept',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  quizShareController.acceptShare
);

/**
 * @swagger
 * /quizzes/shares/{id}/reject:
 *   patch:
 *     summary: Ulashilgan testni rad etish
 *     tags: [Quizzes]
 *     description: "Ruxsat: qabul qiluvchi o'qituvchi. Faqat 'pending' holatidan chaqiriladi."
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       200:
 *         description: Rad etildi
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       400: { description: "So'rov allaqachon javob berilgan" }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { description: "Bu sizga ulashilgan so'rov emas" }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch(
  '/shares/:id/reject',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  quizShareController.rejectShare
);

module.exports = router;
