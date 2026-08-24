// src/modules/books/book.routes.js

const express = require('express');
const router = express.Router();

const bookController = require('./book.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { uploadImage, uploadMaterial } = require('../../middleware/upload');
const { bookValidation } = require('./book.validation');

const TEACHING_ROLES = ['teacher', 'admin', 'superadmin'];

/**
 * @swagger
 * /books:
 *   get:
 *     summary: Kitoblar ro'yxatini olish
 *     tags: [Books]
 *     security: []
 *     description: "Login qilingan bo'lsa (ixtiyoriy token) o'zining draft kitoblari ham ko'rinadi"
 *     parameters:
 *       - { name: category, in: query, schema: { type: string } }
 *       - { name: grade, in: query, schema: { type: integer, minimum: 1, maximum: 11 } }
 *       - { name: search, in: query, schema: { type: string } }
 *       - { name: page, in: query, schema: { type: integer, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, default: 10 } }
 *     responses:
 *       200:
 *         description: Kitoblar ro'yxati
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Book' }
 */
// GET /api/v1/books — public (login bo'lsa o'zining draft kitoblari ham ko'rinadi)
router.get('/', authenticate.optional, bookController.getBooks);

/**
 * @swagger
 * /books/{id}:
 *   get:
 *     summary: Kitobni ID bo'yicha olish
 *     tags: [Books]
 *     security: []
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       200:
 *         description: Kitob
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Book' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// GET /api/v1/books/:id — public
router.get('/:id', authenticate.optional, bookController.getBookById);

/**
 * @swagger
 * /books/{id}/download:
 *   get:
 *     summary: Kitob faylini yuklab olish (downloadsCount oshadi)
 *     tags: [Books]
 *     security: []
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       200:
 *         description: Fayl (PDF)
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// GET /api/v1/books/:id/download — public (faylni beradi, downloadsCount oshiradi)
router.get('/:id/download', authenticate.optional, bookController.downloadBook);

/**
 * @swagger
 * /books:
 *   post:
 *     summary: Yangi kitob yaratish
 *     tags: [Books]
 *     description: "Ruxsat: teacher, admin, superadmin"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, author, category]
 *             properties:
 *               title: { type: string, minLength: 2, maxLength: 150 }
 *               author: { type: string, minLength: 2, maxLength: 100 }
 *               description: { type: string, maxLength: 2000 }
 *               category: { type: string, description: 'BookCategory ObjectId' }
 *               grade: { type: integer, minimum: 1, maximum: 11 }
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
 *                     data: { $ref: '#/components/schemas/Book' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
// POST /api/v1/books
router.post(
  '/',
  authenticate,
  authorize(...TEACHING_ROLES),
  bookValidation,
  validate,
  bookController.createBook
);

/**
 * @swagger
 * /books/{id}:
 *   patch:
 *     summary: Kitobni yangilash (isPublished shu orqali ham o'zgaradi)
 *     tags: [Books]
 *     description: "Ruxsat: kitob egasi yoki admin/superadmin"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               author: { type: string }
 *               description: { type: string }
 *               category: { type: string }
 *               grade: { type: integer, minimum: 1, maximum: 11 }
 *               isPublished: { type: boolean }
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
 *                     data: { $ref: '#/components/schemas/Book' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// PATCH /api/v1/books/:id — egasi yoki admin/superadmin (isPublished shu orqali ham o'zgaradi)
router.patch('/:id', authenticate, authorize(...TEACHING_ROLES), bookController.updateBook);

/**
 * @swagger
 * /books/{id}:
 *   delete:
 *     summary: Kitobni o'chirish
 *     tags: [Books]
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
// DELETE /api/v1/books/:id
router.delete('/:id', authenticate, authorize(...TEACHING_ROLES), bookController.deleteBook);

/**
 * @swagger
 * /books/{id}/cover:
 *   post:
 *     summary: Kitob muqovasini yuklash
 *     tags: [Books]
 *     description: "Ruxsat: teacher, admin, superadmin"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [cover]
 *             properties:
 *               cover: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Muqova yuklandi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Book' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
// POST /api/v1/books/:id/cover — muqova rasmi
router.post(
  '/:id/cover',
  authenticate,
  authorize(...TEACHING_ROLES),
  uploadImage('books/covers').single('cover'),
  bookController.uploadCover
);

/**
 * @swagger
 * /books/{id}/file:
 *   post:
 *     summary: Kitob faylini (PDF) yuklash
 *     tags: [Books]
 *     description: "Ruxsat: teacher, admin, superadmin"
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Fayl yuklandi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Book' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
// POST /api/v1/books/:id/file — kitobning o'zi (PDF)
router.post(
  '/:id/file',
  authenticate,
  authorize(...TEACHING_ROLES),
  uploadMaterial('books/files').single('file'),
  bookController.uploadFile
);

module.exports = router;
