// src/modules/payment/payment.service.js
// Biznes logika: DB bilan ishlash + multicard.service orqali Multicard API'ga murojaat

const crypto = require('crypto');
const Payment = require('./payment.model');
const multicardService = require('./multicard.service');
const ApiError = require('../../utils/ApiError');

// ─────────────────────────────────────────
// TO'LOV YARATISH
// ─────────────────────────────────────────
const createPayment = async ({ userId, amount, returnUrl, ofd }) => {
  // Har bir to'lov uchun o'ziga xos invoiceId generatsiya qilamiz
  const invoiceId = `ord_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  const invoice = await multicardService.createInvoice({
    amount,
    invoiceId,
    callbackUrl: process.env.MULTICARD_CALLBACK_URL,
    returnUrl,
    ofd,
  });

  const payment = await Payment.create({
    user: userId,
    invoiceId,
    multicardUuid: invoice.uuid,
    amount,
    status: 'draft',
  });

  return { payment, checkoutUrl: invoice.checkoutUrl };
};

// ─────────────────────────────────────────
// CALLBACK SIGN TEKSHIRISH
// Multicard hujjatiga ko'ra: md5(store_id + invoice_id + amount + secret)
// ─────────────────────────────────────────
const isSignValid = ({ invoiceId, amount, sign }) => {
  const raw = `${process.env.MULTICARD_STORE_ID}${invoiceId}${amount}${process.env.MULTICARD_SECRET}`;
  const expectedSign = crypto.createHash('md5').update(raw).digest('hex');
  return expectedSign === sign;
};

// ─────────────────────────────────────────
// CALLBACK'NI QAYTA ISHLASH (idempotent)
// ─────────────────────────────────────────
const applyCallback = async ({
  invoiceId,
  uuid,
  amount,
  status,
  receiptUrl,
  cardPan,
  paymentTime,
  sign,
}) => {
  if (!isSignValid({ invoiceId, amount, sign })) {
    throw new ApiError(400, "Sign noto'g'ri — callback ishonchsiz");
  }

  const payment = await Payment.findOne({ invoiceId });
  if (!payment) {
    throw new ApiError(404, "Bunday invoiceId bilan to'lov topilmadi");
  }

  // Idempotentlik: agar bu to'lov allaqachon shu uuid bilan yakunlangan bo'lsa,
  // qayta yozmasdan shunchaki muvaffaqiyatli deb qaytaramiz.
  if (payment.status === 'success' && payment.multicardUuid === uuid) {
    return payment;
  }

  payment.multicardUuid = uuid;
  payment.status = status;
  payment.callbackReceivedAt = new Date();

  if (status === 'success') {
    payment.receiptUrl = receiptUrl ?? payment.receiptUrl;
    payment.cardPan = cardPan ?? payment.cardPan;
    payment.paymentTime = paymentTime ? new Date(paymentTime) : new Date();
  }

  await payment.save();
  return payment;
};

// ─────────────────────────────────────────
// TO'LOV HOLATINI OLISH (frontend uchun)
// ─────────────────────────────────────────
const getStatusByInvoiceId = async (invoiceId) => {
  const payment = await Payment.findOne({ invoiceId });
  if (!payment) {
    throw new ApiError(404, "Bunday invoiceId bilan to'lov topilmadi");
  }
  return payment;
};

module.exports = {
  createPayment,
  applyCallback,
  getStatusByInvoiceId,
};
