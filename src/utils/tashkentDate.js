// src/utils/tashkentDate.js
// Server qaysi timezone'da ishlashidan qat'i nazar, "kunlik" mantiq (streak, spin limiti)
// har doim Toshkent kalendar kuniga asoslanishi uchun — 'YYYY-MM-DD' shaklida qaytaradi.

const TASHKENT_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' });

const getTashkentDateString = (offsetDays = 0) => {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return TASHKENT_DATE_FORMATTER.format(date);
};

module.exports = { getTashkentDateString };
