// src/modules/promocodes/promocode.routes.js

const express = require('express');
const router = express.Router();

const promocodeController = require('./promocode.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { promoCodeValidation } = require('./promocode.validation');

const STAFF_ROLES = ['admin', 'superadmin'];

// GET /api/v1/promo-codes/preview?code=&purpose=&courseId= — public
router.get('/preview', promocodeController.previewDiscount);

// POST /api/v1/promo-codes — admin
router.post(
  '/',
  authenticate,
  authorize(...STAFF_ROLES),
  promoCodeValidation,
  validate,
  promocodeController.createPromoCode
);

// GET /api/v1/promo-codes — admin
router.get('/', authenticate, authorize(...STAFF_ROLES), promocodeController.getPromoCodes);

// PATCH /api/v1/promo-codes/:id — admin
router.patch('/:id', authenticate, authorize(...STAFF_ROLES), promocodeController.updatePromoCode);

// DELETE /api/v1/promo-codes/:id — admin
router.delete('/:id', authenticate, authorize(...STAFF_ROLES), promocodeController.deletePromoCode);

module.exports = router;
