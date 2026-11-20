// src/modules/user-activity/userActivity.service.js
// Faollik jurnali — asosiy amalni HECH QACHON buzmaydi: yozib bo'lmasa faqat log qilinadi.

const UserActivity = require('./userActivity.model');

const SECRET_KEYS = /pass|token|secret|otp|code/i;

// meta'dan maxfiy ko'rinadigan kalitlarni olib tashlaydi (ehtiyot chorasi)
const sanitizeMeta = (meta = {}) =>
  Object.fromEntries(Object.entries(meta).filter(([key]) => !SECRET_KEYS.test(key)));

const logActivity = async ({ userId, type, actorId = null, meta = {} }) => {
  try {
    const actor = actorId && String(actorId) !== String(userId) ? actorId : null;
    return await UserActivity.create({ user: userId, type, actor, meta: sanitizeMeta(meta) });
  } catch (err) {
    console.error(`⚠️ UserActivity yozilmadi (${type}, user=${userId}):`, err.message);
    return null;
  }
};

// So'rovdan kirish konteksti. IP to'g'ri bo'lishi uchun Nginx orqasida
// app.set('trust proxy', ...) sozlangan bo'lishi kerak — aks holda proksi IP'si yoziladi
const requestContext = (req) => ({
  ip: req.ip ?? null,
  userAgent: req.get?.('user-agent') ?? null,
});

const formatGrade = (grade) =>
  grade?.number ? `${grade.number}${grade.letter ? `-${grade.letter}` : ''}` : null;

module.exports = { logActivity, requestContext, formatGrade };
