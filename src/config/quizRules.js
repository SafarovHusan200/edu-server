// src/config/quizRules.js

module.exports = {
  // Quizni faollashtirish (isActive: true) uchun kamida shuncha savol bo'lishi shart —
  // uch bosqich: 1-4 (boshlang'ich), 5-8 (o'rta), 9-11 (yuqori)
  ELEMENTARY_MAX_GRADE: 4,
  MIDDLE_MAX_GRADE: 8,
  MIN_QUESTIONS_ELEMENTARY: 10, // 1-4-sinflar uchun
  MIN_QUESTIONS_MIDDLE: 20, // 5-8-sinflar uchun
  MIN_QUESTIONS_SENIOR: 25, // 9-11-sinflar uchun
};
