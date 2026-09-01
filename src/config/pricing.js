// src/config/pricing.js

// Faqat 1 oylik narx .env orqali sozlanadi — qolgan davrlar (3/6/12 oy) narxi
// shundan avtomatik hisoblanadi (uzoqroq muddat = oyiga arzonroq, DISCOUNT_PERCENT
// bo'yicha). Tiyinda (1 so'm = 100 tiyin) — Multicard bilan bir xil birlik.
const MONTHLY_PRICE = Number(process.env.PREMIUM_PRICE_1M) || 5000000; // 50 000 so'm

// Har bir davr — necha oy va 1 oylik narxga nisbatan necha foiz chegirma
const PLAN_DEFS = {
  '1m': { months: 1, discountPercent: 0 },
  '3m': { months: 3, discountPercent: 10 },
  '6m': { months: 6, discountPercent: 20 },
  '1y': { months: 12, discountPercent: 30 },
};

// Chiroyli son chiqishi uchun 1000 tiyin (10 so'm)ga yaxlitlanadi
const roundPrice = (amount) => Math.round(amount / 1000) * 1000;

// { '1m': { months: 1, price: 5000000, pricePerMonth: 5000000, discountPercent: 0 }, ... }
// pricePerMonth va discountPercent — frontend narxlar jadvalida "oyiga X so'm" va
// "N% chegirma" ko'rsatishi uchun (masalan solishtiruv jadvali/badge)
const PREMIUM_PLANS = Object.fromEntries(
  Object.entries(PLAN_DEFS).map(([key, { months, discountPercent }]) => {
    const price = roundPrice(MONTHLY_PRICE * months * (1 - discountPercent / 100));
    return [
      key,
      {
        months,
        price,
        pricePerMonth: roundPrice(price / months),
        discountPercent,
      },
    ];
  })
);

module.exports = { PREMIUM_PLANS };
