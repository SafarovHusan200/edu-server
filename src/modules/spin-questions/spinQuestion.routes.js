// src/modules/spin-questions/spinQuestion.routes.js

const express = require('express');
const router = express.Router();

const spinQuestionController = require('./spinQuestion.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { spinQuestionValidation, updateSpinQuestionValidation } = require('./spinQuestion.validation');

const STAFF_ROLES = ['admin', 'superadmin'];

router.use(authenticate, authorize(...STAFF_ROLES));

/**
 * @swagger
 * /spin-questions:
 *   post:
 *     summary: Kunlik barabon uchun yangi savol qo'shish
 *     tags: [SpinQuestions]
 *     description: >
 *       Ruxsat: admin, superadmin. category='knowledge' (standart) bo'lsa grade (1-11)
 *       majburiy — POST /daily-spin/spin'da shu sinfdagi studentlarga tushadi.
 *       category='logic' bo'lsa grade berilmaydi — bu savol SINFDAN QAT'I NAZAR
 *       barcha studentlarga umumiy to'plamdan tasodifiy tushishi mumkin.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [question, options, correctIndex]
 *             properties:
 *               category: { type: string, enum: [knowledge, logic], default: knowledge }
 *               grade: { type: integer, minimum: 1, maximum: 11, description: "category='knowledge' uchun majburiy, 'logic' uchun berilmasin" }
 *               question: { type: string }
 *               options: { type: array, items: { type: string }, minItems: 4, maxItems: 4 }
 *               correctIndex: { type: integer, minimum: 0, maximum: 3, description: "options massividagi to'g'ri javobning indeksi" }
 *               isActive: { type: boolean, default: true }
 *     responses:
 *       201:
 *         description: Qo'shildi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { type: object, properties: { question: { $ref: '#/components/schemas/SpinQuestion' } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post('/', spinQuestionValidation, validate, spinQuestionController.createSpinQuestion);

/**
 * @swagger
 * /spin-questions:
 *   get:
 *     summary: Savollar ro'yxati (boshqaruv paneli uchun)
 *     tags: [SpinQuestions]
 *     description: "Ruxsat: admin, superadmin"
 *     parameters:
 *       - { name: page, in: query, schema: { type: integer, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, default: 10 } }
 *       - { name: grade, in: query, schema: { type: integer, minimum: 1, maximum: 11 } }
 *       - { name: category, in: query, schema: { type: string, enum: [knowledge, logic] } }
 *     responses:
 *       200:
 *         description: Ro'yxat
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
 *                         questions: { type: array, items: { $ref: '#/components/schemas/SpinQuestion' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/', spinQuestionController.getSpinQuestions);

/**
 * @swagger
 * /spin-questions/{id}:
 *   patch:
 *     summary: Savolni tahrirlash
 *     tags: [SpinQuestions]
 *     description: "Ruxsat: admin, superadmin"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               category: { type: string, enum: [knowledge, logic] }
 *               grade: { type: integer, minimum: 1, maximum: 11 }
 *               question: { type: string }
 *               options: { type: array, items: { type: string }, minItems: 4, maxItems: 4 }
 *               correctIndex: { type: integer, minimum: 0, maximum: 3 }
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
 *                     data: { type: object, properties: { question: { $ref: '#/components/schemas/SpinQuestion' } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.patch('/:id', updateSpinQuestionValidation, validate, spinQuestionController.updateSpinQuestion);

/**
 * @swagger
 * /spin-questions/{id}:
 *   delete:
 *     summary: Savolni o'chirish
 *     tags: [SpinQuestions]
 *     description: "Ruxsat: admin, superadmin"
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
router.delete('/:id', spinQuestionController.deleteSpinQuestion);

module.exports = router;
