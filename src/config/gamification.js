// src/config/gamification.js

module.exports = {
  // 100% natija uchun beriladigan diamond — haqiqiy miqdor scorePercentga
  // proportsional hisoblanadi (masalan 70% -> 7, 75% -> 7.5)
  QUIZ_MAX_REWARD: 10,
  LESSON_COMPLETE_REWARD: 5, // bitta darsni tugatganda

  // Premium foydalanuvchi test/dars uchun oladigan diamondga qo'llanadigan koeffitsient
  PREMIUM_DIAMOND_MULTIPLIER: 1.5,

  // Kunlik barabon (spin) — standart 1 marta, premium 3 martagacha aylantira oladi
  STANDARD_SPINS_PER_DAY: 1,
  PREMIUM_SPINS_PER_DAY: 3,

  // Har bir aylantirishda tushishi mumkin bo'lgan diamond miqdorlari (teng ehtimollik
  // bilan tanlanadi — kichik qiymatlar ko'proq takrorlangani uchun kamdan-kam katta yutuq tushadi)
  SPIN_PRIZE_TABLE: [1, 1, 2, 2, 3, 3, 4, 5],
};
