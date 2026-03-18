const express = require('express');
const router = express.Router();
const { validationResult } = require('express-validator');

const authController = require('./auth.controller');
const authenticate = require('../../middleware/authenticate');
const {
  registerValidation,
  loginValidation,
  telegramAuthValidation,
} = require('./auth.validation');

// ─────────────────────────────────────────
// Validation middleware
// ─────────────────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      statusCode: 422,
      message: 'Validatsiya xatosi',
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

// ─────────────────────────────────────────
// Routes
// ─────────────────────────────────────────

// POST /api/v1/auth/register
router.post('/register', registerValidation, validate, authController.register);

// POST /api/v1/auth/login
router.post('/login', loginValidation, validate, authController.login);

// POST /api/v1/auth/telegram
router.post('/telegram', telegramAuthValidation, validate, authController.telegramAuth);

// GET /api/v1/auth/me  ← Private
router.get('/me', authenticate, authController.getMe);

module.exports = router;
