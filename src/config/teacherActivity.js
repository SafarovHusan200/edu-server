// src/config/teacherActivity.js

module.exports = {
  // "Eng faol o'qituvchilar" reytingi (GET /stats/top-teachers) uchun og'irlik
  // koeffitsientlari — har bir yaratilgan kontent turi turlicha "og'irlikda"
  // hisoblanadi (kurs yaratish testdan, u esa darsdan ko'proq mehnat talab qiladi
  // deb faraz qilingan). Kerak bo'lsa shu yerdan sozlash mumkin, kod o'zgarmaydi.
  ACTIVITY_WEIGHTS: {
    course: 3,
    quiz: 2,
    lesson: 1,
    book: 2,
  },
};
