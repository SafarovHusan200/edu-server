// src/modules/payment/payment.routes.js

const express = require('express');
const router = express.Router();

const paymentController = require('./payment.controller');
const authenticate = require('../../middleware/authenticate');

// POST /api/v1/payment/create — Private (foydalanuvchi login qilgan bo'lishi kerak)
router.post('/create', authenticate, paymentController.createPayment);

// POST /api/v1/payment/callback — Public
// DIQQAT: bu route auth/CSRF middleware'siz qoldirilishi SHART,
// chunki Multicard server tashqi tomondan (token'siz) so'rov yuboradi.
router.post('/callback', paymentController.handleCallback);

// GET /api/v1/payment/status/:invoiceId — Private
router.get('/status/:invoiceId', authenticate, paymentController.getPaymentStatus);

module.exports = router;
