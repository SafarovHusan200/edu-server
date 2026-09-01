// src/modules/promocodes/promocode.controller.js

const promocodeService = require('./promocode.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');

// POST /api/v1/promo-codes
const createPromoCode = asyncHandler(async (req, res) => {
  const { code, discountPercent, expiresAt, maxUses } = req.body;

  const promoCode = await promocodeService.createPromoCode({
    code,
    discountPercent,
    expiresAt,
    maxUses,
  });

  res.status(201).json(new ApiResponse(201, 'Promokod yaratildi', { promoCode }));
});

// GET /api/v1/promo-codes
const getPromoCodes = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;

  const { promoCodes, meta } = await promocodeService.getPromoCodes({ page, limit });

  res.status(200).json(new ApiResponse(200, "Promokodlar ro'yxati", { promoCodes, meta }));
});

// PATCH /api/v1/promo-codes/:id
const updatePromoCode = asyncHandler(async (req, res) => {
  const promoCode = await promocodeService.updatePromoCode(req.params.id, req.body);

  res.status(200).json(new ApiResponse(200, 'Promokod yangilandi', { promoCode }));
});

// DELETE /api/v1/promo-codes/:id
const deletePromoCode = asyncHandler(async (req, res) => {
  await promocodeService.deletePromoCode(req.params.id);

  res.status(200).json(new ApiResponse(200, "Promokod o'chirildi"));
});

// GET /api/v1/promo-codes/preview
const previewDiscount = asyncHandler(async (req, res) => {
  const { code, purpose, plan } = req.query;
  if (!code || !purpose) throw new ApiError(400, 'code va purpose kiritilishi shart');

  const result = await promocodeService.previewDiscount({ code, purpose, plan });

  res.status(200).json(new ApiResponse(200, 'Chegirma hisoblandi', result));
});

module.exports = {
  createPromoCode,
  getPromoCodes,
  updatePromoCode,
  deletePromoCode,
  previewDiscount,
};
