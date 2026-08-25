// src/utils/diamonds.js

const { PREMIUM_DIAMOND_MULTIPLIER } = require('../config/gamification');

// Premium foydalanuvchi uchun diamond miqdorini koeffitsient bilan ko'paytiradi
const applyDiamondMultiplier = (amount, tarif) => {
  if (tarif !== 'premium') return amount;
  return Math.round(amount * PREMIUM_DIAMOND_MULTIPLIER * 100) / 100;
};

module.exports = { applyDiamondMultiplier };
