// src/modules/payment/payment.service.js
// Biznes logika: DB bilan ishlash + multicard.service orqali Multicard API'ga murojaat

const crypto = require('crypto');
const Payment = require('./payment.model');
const Course = require('../courses/course.model');
const Enrollment = require('../enrollment/enrollment.model');
const User = require('../users/user.model');
const notificationService = require('../notifications/notification.service');
const multicardService = require('./multicard.service');
const ApiError = require('../../utils/ApiError');

const MIN_WALLET_TOPUP = 1000; // tiyin

// ─────────────────────────────────────────
// TO'LOV YARATISH
// ─────────────────────────────────────────
const createPayment = async ({ userId, purpose = 'wallet', courseId, amount, returnUrl, ofd }) => {
  let finalAmount = amount;
  let course = null;

  if (purpose === 'course') {
    if (!courseId) throw new ApiError(400, "purpose='course' uchun courseId kiritilishi shart");

    course = await Course.findById(courseId);
    if (!course || !course.isPublished) throw new ApiError(404, 'Kurs topilmadi');
    if (course.price <= 0) throw new ApiError(400, 'Bu kurs bepul — to\'lov shart emas');

    const existingEnrollment = await Enrollment.findOne({ student: userId, course: courseId });
    if (existingEnrollment && existingEnrollment.status !== 'cancelled') {
      throw new ApiError(400, 'Siz bu kursga allaqachon yozilgansiz');
    }

    // Summani clientdan emas, serverdagi kurs narxidan olamiz — bo'lmasa client
    // to'lov summasini o'zgartirib yuborishi mumkin edi.
    finalAmount = course.price;
  } else {
    if (!amount || amount < MIN_WALLET_TOPUP) {
      throw new ApiError(400, `Hisobni to'ldirish summasi kamida ${MIN_WALLET_TOPUP} tiyin bo'lishi kerak`);
    }
  }

  // Har bir to'lov uchun o'ziga xos invoiceId generatsiya qilamiz
  const invoiceId = `ord_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  const invoice = await multicardService.createInvoice({
    amount: finalAmount,
    invoiceId,
    callbackUrl: process.env.MULTICARD_CALLBACK_URL,
    returnUrl,
    ofd,
  });

  const payment = await Payment.create({
    user: userId,
    invoiceId,
    multicardUuid: invoice.uuid,
    amount: finalAmount,
    purpose,
    course: course?._id ?? null,
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

// To'lov muvaffaqiyatli bo'lganda maqsadiga qarab natija yaratadi (idempotent)
const grantPaymentOutcome = async (payment) => {
  if (payment.purpose === 'course' && payment.course) {
    const existing = await Enrollment.findOne({ student: payment.user, course: payment.course });

    if (!existing || existing.status === 'cancelled') {
      await (existing
        ? Enrollment.findByIdAndUpdate(existing._id, {
            status: 'active',
            paymentRef: payment._id,
            enrolledAt: new Date(),
          })
        : Enrollment.create({
            student: payment.user,
            course: payment.course,
            paymentRef: payment._id,
          }));
    }

    await notificationService.createNotification({
      userId: payment.user,
      type: 'payment',
      title: "To'lov muvaffaqiyatli",
      message: "To'lovingiz qabul qilindi va kursga yozildingiz",
      meta: { paymentId: payment._id, courseId: payment.course },
    });
  } else {
    await User.findByIdAndUpdate(payment.user, { $inc: { balance: payment.amount } });

    await notificationService.createNotification({
      userId: payment.user,
      type: 'payment',
      title: "To'lov muvaffaqiyatli",
      message: 'Hisobingiz balansi to\'ldirildi',
      meta: { paymentId: payment._id, amount: payment.amount },
    });
  }
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
  // qayta yozmasdan (va qayta balans/enrollment bermasdan) shunchaki muvaffaqiyatli deb qaytaramiz.
  if (payment.status === 'success' && payment.multicardUuid === uuid) {
    return payment;
  }

  const wasAlreadySuccess = payment.status === 'success';

  payment.multicardUuid = uuid;
  payment.status = status;
  payment.callbackReceivedAt = new Date();

  if (status === 'success') {
    payment.receiptUrl = receiptUrl ?? payment.receiptUrl;
    payment.cardPan = cardPan ?? payment.cardPan;
    payment.paymentTime = paymentTime ? new Date(paymentTime) : new Date();
  }

  await payment.save();

  if (status === 'success' && !wasAlreadySuccess) {
    await grantPaymentOutcome(payment);
  }

  return payment;
};

// ─────────────────────────────────────────
// TO'LOV HOLATINI OLISH (frontend uchun)
// ─────────────────────────────────────────
const getStatusByInvoiceId = async (invoiceId, userId, role) => {
  const payment = await Payment.findOne({ invoiceId });
  if (!payment) {
    throw new ApiError(404, "Bunday invoiceId bilan to'lov topilmadi");
  }

  const isOwner = payment.user.toString() === userId.toString();
  const isAdmin = ['admin', 'superadmin'].includes(role);

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "Siz bu to'lovni ko'ra olmaysiz");
  }

  return payment;
};

module.exports = {
  createPayment,
  applyCallback,
  getStatusByInvoiceId,
};
