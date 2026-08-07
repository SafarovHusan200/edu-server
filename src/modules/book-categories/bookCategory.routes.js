// src/modules/book-categories/bookCategory.routes.js

const express = require('express');
const router = express.Router();

const bookCategoryController = require('./bookCategory.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { bookCategoryValidation } = require('./bookCategory.validation');

// GET /api/v1/book-categories — public
router.get('/', bookCategoryController.getBookCategories);

// GET /api/v1/book-categories/:id — public
router.get('/:id', bookCategoryController.getBookCategoryById);

// POST /api/v1/book-categories
router.post(
  '/',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  bookCategoryValidation,
  validate,
  bookCategoryController.createBookCategory
);

// PATCH /api/v1/book-categories/:id
router.patch(
  '/:id',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  bookCategoryController.updateBookCategory
);

// DELETE /api/v1/book-categories/:id
router.delete(
  '/:id',
  authenticate,
  authorize('admin', 'superadmin'),
  bookCategoryController.deleteBookCategory
);

module.exports = router;
