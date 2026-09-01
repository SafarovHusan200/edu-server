// src/modules/payment/payment.service.js
// Biznes logika: DB bilan ishlash + multicard.service orqali Multicard API'ga murojaat

const crypto = require('crypto');
const Payment = require('./payment.model');
const Course = require('../courses/course.model');
const Enrollment = require('../enrollment/enrollment.model');
const User = require('../users/user.model');
const PromoCode = require('../promocodes/promocode.model');
const promocodeService = require('../promocodes/promocode.service');
const notificationService = require('../notifications/notification.service');
const multicardService = require('./multicard.service');
const ApiError = require('../../utils/ApiError');
const { PREMIUM_PLANS } = require('../../config/pricing');

const MIN_WALLET_TOPUP = 1000; // tiyin

// Bildirishnomalarda summani tiyindan so'mga, minglik ajratgich bilan ko'rsatish uchun
const formatSom = (tiyin) => Math.round(tiyin / 100).toLocaleString('uz-UZ');

// Bildirishnomalarda muddatni "27.08.2026" ko'rinishida, Toshkent vaqti bo'yicha ko'rsatish uchun
const formatSomDate = (date) =>
  date.toLocaleDateString('uz-UZ', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric' });

// ─────────────────────────────────────────
// TO'LOV YARATISH
// ─────────────────────────────────────────
const createPayment = async ({ userId, purpose = 'wallet', courseId, amount, promoCode, returnUrl, ofd, plan }) => {
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
  } else if (purpose === 'premium') {
    // Diqqat: allaqachon premium bo'lgan userga ham to'lov ruxsat etiladi — bu holda
    // muddat cho'zib (uzaytirib) beriladi (grantPaymentOutcome'da hisoblanadi),
    // bloklab qo'yilmaydi — chunki muddati tugashidan oldin qayta sotib olish normal holat.
    const plan_ = PREMIUM_PLANS[plan];
    if (!plan_) {
      throw new ApiError(
        400,
        `Noto'g'ri reja. Mavjud rejalar: ${Object.keys(PREMIUM_PLANS).join(', ')}`
      );
    }

    finalAmount = plan_.price;
  } else if (purpose === 'donation') {
    if (!amount || amount < MIN_WALLET_TOPUP) {
      throw new ApiError(400, `Xayriya summasi kamida ${MIN_WALLET_TOPUP} tiyin bo'lishi kerak`);
    }
  } else {
    if (!amount || amount < MIN_WALLET_TOPUP) {
      throw new ApiError(400, `Hisobni to'ldirish summasi kamida ${MIN_WALLET_TOPUP} tiyin bo'lishi kerak`);
    }
  }

  let promoCodeDoc = null;
  let discountPercent = null;

  if (promoCode) {
    // Promokod faqat premium sotib olishda amal qiladi — boshqa purpose bilan
    // yuborilsa aniq xato qaytariladi (jimgina e'tiborsiz qoldirilmaydi)
    if (purpose !== 'premium') {
      throw new ApiError(400, "Promokod faqat premium sotib olishda ishlatiladi");
    }

    // Chegirma foizi ham serverda, promo koddan olinadi — client foizni o'zi yubormaydi
    promoCodeDoc = await promocodeService.validatePromoCode(promoCode);
    discountPercent = promoCodeDoc.discountPercent;
    finalAmount = Math.round(finalAmount * (1 - discountPercent / 100));
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
    plan: purpose === 'premium' ? plan : null,
    course: course?._id ?? null,
    promoCode: promoCodeDoc?._id ?? null,
    discountPercent,
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
    const [existing, course] = await Promise.all([
      Enrollment.findOne({ student: payment.user, course: payment.course }),
      Course.findById(payment.course).select('title teacher').populate('teacher', 'name'),
    ]);

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
      title: "✅ To'lov muvaffaqiyatli!",
      message: `📚 Kurs: "${course?.title ?? '—'}"\n👨‍🏫 O'qituvchi: ${course?.teacher?.name ?? '—'}\n💳 To'langan summa: ${formatSom(payment.amount)} so'm\n🎓 Siz ushbu kursga muvaffaqiyatli yozildingiz!`,
      meta: { paymentId: payment._id, courseId: payment.course },
    });
  } else if (payment.purpose === 'premium') {
    const user = await User.findById(payment.user).select('tarif premiumExpiresAt');
    const plan = PREMIUM_PLANS[payment.plan];
    const daysToAdd = plan?.days ?? 30; // amalda payment.plan har doim to'g'ri saqlangan bo'ladi

    // Hali muddati tugamagan premium bo'lsa — qolgan muddat ustiga QO'SHILADI (uzaytiriladi),
    // aks holda (birinchi marta yoki muddati o'tgan) bugundan boshlab hisoblanadi.
    // Kun (setDate) bilan qo'shiladi — oy uzunligi turlicha (28/30/31) bo'lgani uchun
    // setMonth() aniq bo'lmagan natija berishi mumkin edi.
    const now = new Date();
    const baseDate =
      user.tarif === 'premium' && user.premiumExpiresAt && user.premiumExpiresAt > now
        ? user.premiumExpiresAt
        : now;

    const newExpiry = new Date(baseDate);
    newExpiry.setDate(newExpiry.getDate() + daysToAdd);

    await User.findByIdAndUpdate(payment.user, { tarif: 'premium', premiumExpiresAt: newExpiry });

    await notificationService.createNotification({
      userId: payment.user,
      type: 'payment',
      title: '⭐ Premium faollashtirildi!',
      message: `💳 To'langan summa: ${formatSom(payment.amount)} so'm\n⭐ Tarifingiz endi: Premium\n📅 Amal qilish muddati: ${formatSomDate(newExpiry)} gacha`,
      meta: { paymentId: payment._id, premiumExpiresAt: newExpiry },
    });
  } else if (payment.purpose === 'donation') {
    // Xayriya — foydalanuvchiga hech narsa berilmaydi, faqat rahmat xabari yuboriladi
    await notificationService.createNotification({
      userId: payment.user,
      type: 'payment',
      title: '❤️ Xayriya uchun rahmat!',
      message: `💳 Xayriya summasi: ${formatSom(payment.amount)} so'm\n🙏 Sizning hissangiz biz uchun juda muhim!`,
      meta: { paymentId: payment._id, amount: payment.amount },
    });
  } else {
    await User.findByIdAndUpdate(payment.user, { $inc: { balance: payment.amount } });

    await notificationService.createNotification({
      userId: payment.user,
      type: 'payment',
      title: "💰 Hisobingiz to'ldirildi",
      message: `💳 To'ldirilgan summa: ${formatSom(payment.amount)} so'm\n✅ Balansingizga muvaffaqiyatli qo'shildi`,
      meta: { paymentId: payment._id, amount: payment.amount },
    });
  }

  // Draft/muvaffaqiyatsiz to'lovlar promokodni "sarflab" qo'ymasligi uchun
  // usedCount faqat shu yerda, muvaffaqiyatli natija berilgandan keyin oshiriladi
  if (payment.promoCode) {
    await PromoCode.findByIdAndUpdate(payment.promoCode, { $inc: { usedCount: 1 } });
  }
};

// ─────────────────────────────────────────
// HOLATNI SAQLASH VA NATIJA BERISH — callback'dan ham, pastdagi reconciliation
// (Multicard'dan faol so'rash)dan ham chaqiriladi. Ikkalasi deyarli bir vaqtda
// kelib qolishi mumkin (masalan foydalanuvchi status sahifasini yangilagan zahoti
// callback ham kelsa) — shuning uchun oddiy "o'qish → tekshirish → yozish" emas,
// ATOMIK findOneAndUpdate ishlatiladi: status='success'ga o'tish faqat bitta
// so'rov uchun "yutib olinadi", shu bilan balans/premium/enrollment ikki marta
// berilib ketishining oldi olinadi (poyga holati — race condition himoyasi).
// ─────────────────────────────────────────
const applyStatusUpdate = async (payment, { uuid, status, receiptUrl, cardPan, paymentTime }) => {
  const update = {
    multicardUuid: uuid ?? payment.multicardUuid,
    status,
    callbackReceivedAt: new Date(),
  };

  if (status === 'success') {
    update.receiptUrl = receiptUrl ?? payment.receiptUrl;
    update.cardPan = cardPan ?? payment.cardPan;
    update.paymentTime = paymentTime ? new Date(paymentTime) : new Date();
  }

  // status hali 'success' bo'lmagan hujjatnigina yangilaydi — agar parallel so'rov
  // ulgurib "success" qilib bo'lgan bo'lsa, bu yerda 0 ta hujjat topiladi (updated=null)
  // va grantPaymentOutcome QAYTA chaqirilmaydi.
  const updated = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $ne: 'success' } },
    update,
    { new: true }
  );

  if (!updated) {
    // Boshqa so'rov (yoki shu holatning o'zi) allaqachon 'success' qilib ulgurgan —
    // eng so'nggi holatni qaytaramiz, qayta ishlov bermaymiz
    return Payment.findById(payment._id);
  }

  if (status === 'success') {
    await grantPaymentOutcome(updated);
  }

  return updated;
};

// ─────────────────────────────────────────
// CALLBACK'NI QAYTA ISHLASH — Multicard "push" qiladi, imzo tekshiriladi
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

  return applyStatusUpdate(payment, { uuid, status, receiptUrl, cardPan, paymentTime });
};

// ─────────────────────────────────────────
// TO'LOV HOLATINI OLISH (frontend uchun)
// Reconciliation: callback (webhook) yo'qolgan/kelmagan bo'lishi mumkin — shu
// sababli, agar to'lov hali 'success' bo'lmasa, Multicard'ning o'zidan ("pull",
// bizning autentifikatsiya qilingan so'rovimiz — sign tekshiruvi shart emas)
// haqiqiy holat so'raladi va agar u yerda muvaffaqiyatli bo'lsa, shu yerning
// o'zida darhol qo'llaniladi. Alohida cron/job kerak emas — foydalanuvchi
// checkoutdan qaytib shu endpointni chaqirganda o'zi "tuzatib" ketadi.
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

  if (payment.status !== 'success' && payment.multicardUuid) {
    try {
      const invoice = await multicardService.getInvoiceStatus(payment.multicardUuid);

      if (invoice?.status && invoice.status !== payment.status) {
        return await applyStatusUpdate(payment, {
          uuid: payment.multicardUuid,
          status: invoice.status,
          receiptUrl: invoice.receipt_url,
          cardPan: invoice.card_pan,
          paymentTime: invoice.payment_time,
        });
      }
    } catch (err) {
      // Multicard vaqtincha javob bermasa ham, foydalanuvchiga oxirgi ma'lum
      // holatni qaytaramiz — bu so'rovni butunlay muvaffaqiyatsiz qilib qo'ymaydi
      console.error('⚠️ Multicard status reconciliation xatosi:', err.message);
    }
  }

  return payment;
};

// GET /payment/premium-plans — frontend narxlar jadvalini shu yerdan oladi
const getPremiumPlans = () => PREMIUM_PLANS;

module.exports = {
  createPayment,
  applyCallback,
  getStatusByInvoiceId,
  getPremiumPlans,
};
