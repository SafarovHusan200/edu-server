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

// GET /api/v1/books — public (login bo'lsa o'zining draft kitoblari ham ko'rinadi)
router.get('/', authenticate.optional, bookController.getBooks);

// GET /api/v1/books/:id — public
router.get('/:id', authenticate.optional, bookController.getBookById);

// GET /api/v1/books/:id/download — public (faylni beradi, downloadsCount oshiradi)
router.get('/:id/download', authenticate.optional, bookController.downloadBook);

// POST /api/v1/books
router.post(
  '/',
  authenticate,
  authorize(...TEACHING_ROLES),
  bookValidation,
  validate,
  bookController.createBook
);

// PATCH /api/v1/books/:id — egasi yoki admin/superadmin (isPublished shu orqali ham o'zgaradi)
router.patch('/:id', authenticate, authorize(...TEACHING_ROLES), bookController.updateBook);

// DELETE /api/v1/books/:id
router.delete('/:id', authenticate, authorize(...TEACHING_ROLES), bookController.deleteBook);

// POST /api/v1/books/:id/cover — muqova rasmi
router.post(
  '/:id/cover',
  authenticate,
  authorize(...TEACHING_ROLES),
  uploadImage('books/covers').single('cover'),
  bookController.uploadCover
);

// POST /api/v1/books/:id/file — kitobning o'zi (PDF)
router.post(
  '/:id/file',
  authenticate,
  authorize(...TEACHING_ROLES),
  uploadMaterial('books/files').single('file'),
  bookController.uploadFile
);

module.exports = router;
