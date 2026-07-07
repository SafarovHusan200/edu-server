// src/modules/categories/category.routes.js

const express = require('express');
const router = express.Router();

const categoryController = require('./category.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { categoryValidation } = require('./category.validation');

// GET /api/v1/categories — public
router.get('/', categoryController.getCategories);

// GET /api/v1/categories/:id — public
router.get('/:id', categoryController.getCategoryById);

// POST /api/v1/categories
router.post(
  '/',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  categoryValidation,
  validate,
  categoryController.createCategory
);

// PATCH /api/v1/categories/:id
router.patch(
  '/:id',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  categoryController.updateCategory
);

// DELETE /api/v1/categories/:id
router.delete(
  '/:id',
  authenticate,
  authorize('admin', 'superadmin'),
  categoryController.deleteCategory
);

module.exports = router;
