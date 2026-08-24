// src/modules/categories/category.routes.js

const express = require('express');
const router = express.Router();

const categoryController = require('./category.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { categoryValidation } = require('./category.validation');

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: Barcha kurs kategoriyalarini olish
 *     tags: [Categories]
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
 *                       items: { $ref: '#/components/schemas/Category' }
 */
// GET /api/v1/categories — public
router.get('/', categoryController.getCategories);

/**
 * @swagger
 * /categories/{id}:
 *   get:
 *     summary: Kategoriyani ID bo'yicha olish
 *     tags: [Categories]
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
 *                     data: { $ref: '#/components/schemas/Category' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// GET /api/v1/categories/:id — public
router.get('/:id', categoryController.getCategoryById);

/**
 * @swagger
 * /categories:
 *   post:
 *     summary: Yangi kategoriya yaratish
 *     tags: [Categories]
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
 *                     data: { $ref: '#/components/schemas/Category' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
// POST /api/v1/categories
router.post(
  '/',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  categoryValidation,
  validate,
  categoryController.createCategory
);

/**
 * @swagger
 * /categories/{id}:
 *   patch:
 *     summary: Kategoriyani yangilash
 *     tags: [Categories]
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
 *                     data: { $ref: '#/components/schemas/Category' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// PATCH /api/v1/categories/:id
router.patch(
  '/:id',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  categoryController.updateCategory
);

/**
 * @swagger
 * /categories/{id}:
 *   delete:
 *     summary: Kategoriyani o'chirish
 *     tags: [Categories]
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
// DELETE /api/v1/categories/:id
router.delete(
  '/:id',
  authenticate,
  authorize('admin', 'superadmin'),
  categoryController.deleteCategory
);

module.exports = router;
