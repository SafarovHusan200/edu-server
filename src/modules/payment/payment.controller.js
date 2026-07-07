// src/modules/payment/payment.controller.js

const paymentService = require('./payment.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');

// ─────────────────────────────────────────
// POST /api/v1/payment/create — Private
// ─────────────────────────────────────────
const createPayment = asyncHandler(async (req, res) => {
  const { amount, returnUrl, ofd, purpose, courseId } = req.body;

  if (purpose !== 'course' && !amount) {
    throw new ApiError(400, "To'lov summasi (amount) kiritilishi shart");
  }

  const { payment, checkoutUrl } = await paymentService.createPayment({
    userId: req.user.id,
    purpose,
    courseId,
    amount,
    returnUrl,
    ofd,
  });

  res.status(201).json(
    new ApiResponse(201, "To'lov yaratildi", {
      invoiceId: payment.invoiceId,
      checkoutUrl,
    })
  );
});

// ─────────────────────────────────────────
// POST /api/v1/payment/callback — Public (Multicard tomonidan chaqiriladi)
// Multicard doim HTTP 200 kutadi, aks holda to'lovni bekor qilib qo'yishi mumkin
// ─────────────────────────────────────────
const handleCallback = asyncHandler(async (req, res) => {
  const { uuid, amount, invoice_id: invoiceId, status, card_pan: cardPan, payment_time: paymentTime, receipt_url: receiptUrl, sign } = req.body;

  try {
    await paymentService.applyCallback({
      invoiceId,
      uuid,
      amount,
      status,
      cardPan,
      paymentTime,
      receiptUrl,
      sign,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    // Sign noto'g'ri bo'lsa — bu ishonchsiz so'rov, aniq 400 qaytaramiz
    if (error instanceof ApiError && error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }

    // Qolgan barcha holatlarda (masalan, invoice topilmadi) Multicard hujjatiga ko'ra
    // 200 status bilan success:false qaytarish ham "xatolik" sifatida qabul qilinadi,
    // lekin bu to'lovni bekor qilib yubormaydi.
    console.error('❌ Multicard callback xatosi:', error.message);
    return res.status(200).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────
// GET /api/v1/payment/status/:invoiceId — Private
// ─────────────────────────────────────────
const getPaymentStatus = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params;

  const payment = await paymentService.getStatusByInvoiceId(invoiceId, req.user.id, req.user.role);

  res.status(200).json(new ApiResponse(200, "To'lov holati", { payment }));
});

module.exports = {
  createPayment,
  handleCallback,
  getPaymentStatus,
};
