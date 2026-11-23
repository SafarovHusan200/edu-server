// src/utils/pick.js
// So'rov tanasidan faqat ruxsat etilgan maydonlarni oladi (mass assignment himoyasi).
// req.body'ni to'g'ridan-to'g'ri Object.assign/findByIdAndUpdate'ga berish o'qituvchiga
// egalik (teacher/createdBy), reyting, savolning quiz'i kabi maydonlarni ham o'zgartirishga
// imkon berardi. Ro'yxatda yo'q maydonlar jimgina tashlab yuboriladi (eski clientlar buzilmaydi).

const pick = (source, allowedKeys) => {
  const result = {};
  if (!source || typeof source !== 'object') return result;
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
};

module.exports = pick;
