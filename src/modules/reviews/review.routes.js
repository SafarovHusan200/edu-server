// src/modules/reviews/review.routes.js
// Yaratish/ro'yxat /courses/:id/reviews ostida (course.routes.js) — bu yerda
// faqat bitta sharhga tegishli amallar (id orqali).

const express = require('express');
const router = express.Router();

const reviewController = require('./review.controller');
const authenticate = require('../../middleware/authenticate');
const validate = require('../../middleware/validate');
const { reviewValidation } = require('./review.validation');

/**
 * @swagger
 * /reviews/{id}:
 *   patch:
 *     summary: O'z sharhini yangilash
 *     tags: [Reviews]
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               comment: { type: string, maxLength: 1000 }
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
 *                     data: { $ref: '#/components/schemas/Review' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
// PATCH /api/v1/reviews/:id
router.patch('/:id', authenticate, reviewValidation, validate, reviewController.updateReview);

/**
 * @swagger
 * /reviews/{id}:
 *   delete:
 *     summary: Sharhni o'chirish
 *     tags: [Reviews]
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       200:
 *         description: O'chirildi
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// DELETE /api/v1/reviews/:id
router.delete('/:id', authenticate, reviewController.deleteReview);

module.exports = router;
