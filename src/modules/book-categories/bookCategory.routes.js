// src/modules/book-categories/bookCategory.routes.js

const express = require('express');
const router = express.Router();

const bookCategoryController = require('./bookCategory.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { bookCategoryValidation } = require('./bookCategory.validation');

/**
 * @swagger
 * /book-categories:
 *   get:
 *     summary: Barcha kitob kategoriyalarini olish
 *     tags: [BookCategories]
 *     security: []
 *     responses:
 *       200:
 *         description: Kategoriyalar ro'yxati
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/BookCategory' }
 */
// GET /api/v1/book-categories — public
router.get('/', bookCategoryController.getBookCategories);

/**
 * @swagger
 * /book-categories/{id}:
 *   get:
 *     summary: Kitob kategoriyasini ID bo'yicha olish
 *     tags: [BookCategories]
 *     security: []
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       200:
 *         description: Kategoriya
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/BookCategory' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// GET /api/v1/book-categories/:id — public
router.get('/:id', bookCategoryController.getBookCategoryById);

/**
 * @swagger
 * /book-categories:
 *   post:
 *     summary: Yangi kitob kategoriyasini yaratish
 *     tags: [BookCategories]
 *     description: "Ruxsat: teacher, admin, superadmin"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 60 }
 *               description: { type: string, maxLength: 500 }
 *               icon: { type: string, format: uri }
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
 *                     data: { $ref: '#/components/schemas/BookCategory' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
// POST /api/v1/book-categories
router.post(
  '/',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  bookCategoryValidation,
  validate,
  bookCategoryController.createBookCategory
);

/**
 * @swagger
 * /book-categories/{id}:
 *   patch:
 *     summary: Kitob kategoriyasini yangilash
 *     tags: [BookCategories]
 *     description: "Ruxsat: teacher, admin, superadmin"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               icon: { type: string, format: uri }
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
 *                     data: { $ref: '#/components/schemas/BookCategory' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// PATCH /api/v1/book-categories/:id
router.patch(
  '/:id',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  bookCategoryController.updateBookCategory
);

/**
 * @swagger
 * /book-categories/{id}:
 *   delete:
 *     summary: Kitob kategoriyasini o'chirish
 *     tags: [BookCategories]
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
// DELETE /api/v1/book-categories/:id
router.delete(
  '/:id',
  authenticate,
  authorize('admin', 'superadmin'),
  bookCategoryController.deleteBookCategory
);

module.exports = router;
