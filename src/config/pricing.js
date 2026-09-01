// src/config/pricing.js

// Faqat 30 kunlik narx .env orqali sozlanadi — qolgan davrlar (90/180/365 kun) narxi
// shundan avtomatik hisoblanadi (uzoqroq muddat = kuniga arzonroq, PLAN_DEFS'dagi
// discountPercent bo'yicha). Tiyinda (1 so'm = 100 tiyin) — Multicard bilan bir xil birlik.
//
// Muddat OYLARDA emas, KUNLARDA hisoblanadi (premiumExpiresAt'ga setDate() bilan
// qo'shiladi) — bu oy uzunligi turlicha (28/30/31 kun) bo'lishidan kelib chiqadigan
// noaniqlikni oldini oladi, har doim aniq son kun beriladi.
const DAILY_BASE_PRICE = Number(process.env.PREMIUM_PRICE_30D) || 2900000; // 30 kun uchun 29 000 so'm

// Har bir reja — necha kun va 30 kunlik narxga nisbatan necha foiz chegirma
const PLAN_DEFS = {
  '30d': { days: 30, discountPercent: 0 },
  '90d': { days: 90, discountPercent: 10 },
  '180d': { days: 180, discountPercent: 20 },
  '365d': { days: 365, discountPercent: 30 },
};

// Chiroyli son chiqishi uchun 1000 tiyin (10 so'm)ga yaxlitlanadi
const roundPrice = (amount) => Math.round(amount / 1000) * 1000;

// { '30d': { days: 30, price: 2900000, pricePerMonth: 2900000, discountPercent: 0 }, ... }
// pricePerMonth (kunlik narxni ~30 kunga proporsional ko'rsatish) va discountPercent —
// frontend narxlar jadvalida "oyiga X so'm" va "N% chegirma" ko'rsatishi uchun
const PREMIUM_PLANS = Object.fromEntries(
  Object.entries(PLAN_DEFS).map(([key, { days, discountPercent }]) => {
    const price = roundPrice(DAILY_BASE_PRICE * (days / 30) * (1 - discountPercent / 100));
    return [
      key,
      {
        days,
        price,
        pricePerMonth: roundPrice(price / (days / 30)),
        discountPercent,
      },
    ];
  })
);

module.exports = { PREMIUM_PLANS };
