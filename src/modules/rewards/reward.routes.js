// src/modules/rewards/reward.routes.js

const express = require('express');
const router = express.Router();

const rewardController = require('./reward.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { uploadImage } = require('../../middleware/upload');
const { rewardValidation, updateRedemptionValidation } = require('./reward.validation');

const STAFF_ROLES = ['admin', 'superadmin'];

// ───────────────────────────────────────────────────────
// REDEMPTIONS — /:id dan oldin ro'yxatdan o'tkaziladi, aks holda
// "/redemptions" so'zi :id parametri sifatida ushlanib qoladi.
// ───────────────────────────────────────────────────────

// GET /api/v1/rewards/redemptions/my
router.get(
  '/redemptions/my',
  authenticate,
  authorize('student'),
  rewardController.getMyRedemptions
);

// GET /api/v1/rewards/redemptions — admin
router.get('/redemptions', authenticate, authorize(...STAFF_ROLES), rewardController.getAllRedemptions);

// PATCH /api/v1/rewards/redemptions/:id — admin
router.patch(
  '/redemptions/:id',
  authenticate,
  authorize(...STAFF_ROLES),
  updateRedemptionValidation,
  validate,
  rewardController.updateRedemptionStatus
);

// ───────────────────────────────────────────────────────
// REWARD CRUD
// ───────────────────────────────────────────────────────

// GET /api/v1/rewards — public
router.get('/', rewardController.getRewards);

// GET /api/v1/rewards/:id — public
router.get('/:id', rewardController.getRewardById);

// POST /api/v1/rewards — admin
router.post(
  '/',
  authenticate,
  authorize(...STAFF_ROLES),
  rewardValidation,
  validate,
  rewardController.createReward
);

// PATCH /api/v1/rewards/:id — admin
router.patch('/:id', authenticate, authorize(...STAFF_ROLES), rewardController.updateReward);

// DELETE /api/v1/rewards/:id — admin
router.delete('/:id', authenticate, authorize(...STAFF_ROLES), rewardController.deleteReward);

// POST /api/v1/rewards/:id/image — admin
router.post(
  '/:id/image',
  authenticate,
  authorize(...STAFF_ROLES),
  uploadImage('rewards').single('image'),
  rewardController.uploadImage
);

// POST /api/v1/rewards/:id/redeem — student
router.post('/:id/redeem', authenticate, authorize('student'), rewardController.redeemReward);

module.exports = router;
