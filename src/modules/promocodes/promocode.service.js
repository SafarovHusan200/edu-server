// src/modules/promocodes/promocode.service.js

const PromoCode = require('./promocode.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, buildMeta } = require('../../utils/paginate');
const { PREMIUM_PLANS } = require('../../config/pricing');

const createPromoCode = async ({ code, discountPercent, expiresAt, maxUses }) => {
  const existing = await PromoCode.findOne({ code: code.toUpperCase() });
  if (existing) throw new ApiError(400, 'Bu promokod allaqachon mavjud');

  return PromoCode.create({ code, discountPercent, expiresAt: expiresAt ?? null, maxUses: maxUses ?? null });
};

const getPromoCodes = async ({ page, limit }) => {
  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });

  const [promoCodes, total] = await Promise.all([
    PromoCode.find().sort({ createdAt: -1 }).skip(skip).limit(pageLimit),
    PromoCode.countDocuments(),
  ]);

  return { promoCodes, meta: buildMeta(total, currentPage, pageLimit) };
};

const updatePromoCode = async (id, updateData) => {
  const promoCode = await PromoCode.findById(id);
  if (!promoCode) throw new ApiError(404, 'Promokod topilmadi');

  Object.assign(promoCode, updateData);
  await promoCode.save();
  return promoCode;
};

const deletePromoCode = async (id) => {
  const promoCode = await PromoCode.findById(id);
  if (!promoCode) throw new ApiError(404, 'Promokod topilmadi');

  await promoCode.deleteOne();
};

// Ichki qayta ishlatiladigan tekshiruv — payment.service.js ham shu yerdan foydalanadi
const validatePromoCode = async (code) => {
  const promoCode = await PromoCode.findOne({ code: code.toUpperCase() });

  if (!promoCode || !promoCode.isActive) {
    throw new ApiError(400, "Promokod topilmadi yoki faol emas");
  }

  if (promoCode.expiresAt && promoCode.expiresAt < new Date()) {
    throw new ApiError(400, "Promokod muddati tugagan");
  }

  if (promoCode.maxUses !== null && promoCode.usedCount >= promoCode.maxUses) {
    throw new ApiError(400, "Promokod ishlatilish limiti tugagan");
  }

  return promoCode;
};

// Promokod faqat premium sotib olishda qo'llanadi
const resolveBaseAmount = async ({ purpose, plan }) => {
  if (purpose !== 'premium') {
    throw new ApiError(400, "Promokod faqat premium sotib olishda ishlatiladi");
  }

  const plan_ = PREMIUM_PLANS[plan];
  if (!plan_) {
    throw new ApiError(400, `Noto'g'ri reja. Mavjud rejalar: ${Object.keys(PREMIUM_PLANS).join(', ')}`);
  }
  return plan_.price;
};

// GET /promo-codes/preview — checkoutda chegirmani oldindan ko'rsatish uchun
const previewDiscount = async ({ code, purpose, plan }) => {
  const promoCode = await validatePromoCode(code);
  const baseAmount = await resolveBaseAmount({ purpose, plan });
  const finalAmount = Math.round(baseAmount * (1 - promoCode.discountPercent / 100));

  return {
    code: promoCode.code,
    discountPercent: promoCode.discountPercent,
    baseAmount,
    finalAmount,
  };
};

module.exports = {
  createPromoCode,
  getPromoCodes,
  updatePromoCode,
  deletePromoCode,
  validatePromoCode,
  previewDiscount,
};
