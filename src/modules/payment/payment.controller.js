// src/modules/payment/payment.controller.js

const paymentService = require('./payment.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');

// ─────────────────────────────────────────
// POST /api/v1/payment/create — Private
// ─────────────────────────────────────────
const createPayment = asyncHandler(async (req, res) => {
  const { amount, returnUrl, ofd, purpose, courseId, promoCode, plan, useBalance } = req.body;

  if (!['course', 'premium'].includes(purpose) && !amount) {
    throw new ApiError(400, "To'lov summasi (amount) kiritilishi shart");
  }

  const { payment, checkoutUrl, paidWithBalance } = await paymentService.createPayment({
    userId: req.user.id,
    purpose,
    courseId,
    amount,
    promoCode,
    returnUrl,
    ofd,
    plan,
    useBalance,
  });

  res.status(201).json(
    new ApiResponse(201, paidWithBalance ? "To'lov balansdan amalga oshirildi" : "To'lov yaratildi", {
      invoiceId: payment.invoiceId,
      checkoutUrl,
      paidWithBalance,
      status: payment.status,
    })
  );
});

// ─────────────────────────────────────────
// POST /api/v1/payment/callback — Public (Multicard tomonidan chaqiriladi)
// Multicard doim HTTP 200 kutadi, aks holda to'lovni bekor qilib qo'yishi mumkin
// ─────────────────────────────────────────
const handleCallback = asyncHandler(async (req, res) => {
  // invoice_id/amount/sign — imzo shu maydonlardan hisoblanadi, hujjatga ko'ra doim
  // yuqori darajada keladi. status/card_pan/payment_time/receipt_url esa — GET
  // /payment/invoice/:uuid javobida invoice.payment.* ichida kelishi tasdiqlangan
  // (production loglaridan) — callback ham xuddi shunday tuzilishda bo'lishi
  // mumkinligi uchun ikkalasi ham (yuqori daraja va payment.* ichida) tekshiriladi.
  const { uuid, amount, invoice_id: invoiceId, sign, payment: paymentInfo } = req.body;
  const status = req.body.status ?? paymentInfo?.status;
  const cardPan = req.body.card_pan ?? paymentInfo?.card_pan;
  const paymentTime = req.body.payment_time ?? paymentInfo?.payment_time;
  const receiptUrl = req.body.receipt_url ?? paymentInfo?.receipt_url;

  // Vaqtinchalik diagnostika: Multicard'dan aynan qanday maydonlar kelayotganini
  // ko'rish uchun (payment.gatewayDebug'ga saqlanadi — Payment modeliga izohga qarang)
  console.log('📥 Multicard callback body:', JSON.stringify(req.body));

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
      rawBody: req.body,
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

// ─────────────────────────────────────────
// GET /api/v1/payment/premium-plans — Public
// ─────────────────────────────────────────
const getPremiumPlans = asyncHandler(async (req, res) => {
  const plans = paymentService.getPremiumPlans();

  res.status(200).json(new ApiResponse(200, 'Premium rejalar', { plans }));
});

// ─────────────────────────────────────────
// GET /api/v1/payment/my — Private (o'zining to'lovlar tarixi)
// ─────────────────────────────────────────
const getMyPayments = asyncHandler(async (req, res) => {
  const { page, limit, purpose, status } = req.query;

  const { payments, meta } = await paymentService.getMyPayments(req.user.id, {
    page,
    limit,
    purpose,
    status,
  });

  res.status(200).json(new ApiResponse(200, "To'lovlar tarixi", { payments, meta }));
});

// ─────────────────────────────────────────
// GET /api/v1/payment — Private, admin/superadmin (barcha to'lovlar)
// ─────────────────────────────────────────
const getAllPayments = asyncHandler(async (req, res) => {
  const { page, limit, purpose, status, userId } = req.query;

  const { payments, meta } = await paymentService.getAllPayments({
    page,
    limit,
    purpose,
    status,
    userId,
  });

  res.status(200).json(new ApiResponse(200, "Barcha to'lovlar", { payments, meta }));
});

module.exports = {
  createPayment,
  handleCallback,
  getPaymentStatus,
  getPremiumPlans,
  getMyPayments,
  getAllPayments,
};
