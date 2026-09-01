// src/config/frontendLinks.js
// Bildirishnomalarda (in-app va Telegram) foydalanuvchini frontenddagi tegishli
// sahifaga to'g'ridan-to'g'ri olib boradigan havolalar — bitta joyda saqlanadi,
// shunda frontend routing o'zgarsa faqat shu faylni yangilash kifoya.
//
// Barcha yo'llar frontend jamoasi tomonidan haqiqiy route tuzilmasi bo'yicha
// tasdiqlangan/tuzatilgan (2026-09-01).

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://edu-platform.uz';

// Backend o'zi joylashgan manzil — /uploads ostidagi statik fayllarga (masalan
// sertifikat PDF'iga) to'g'ridan-to'g'ri havola qurish uchun (frontend orqali emas)
const BACKEND_URL = process.env.BACKEND_URL || 'https://server.maktab16.uz';

const frontendLinks = {
  login: (code) => `${FRONTEND_URL}/login?tg_code=${code}`,

  // Tasdiqlangan: Multicard to'lovida return_url shu sifatida ishlatilgan
  premium: () => `${FRONTEND_URL}/premium`,

  // Tasdiqlangan: skrinshotdagi sahifa manzili
  rewards: () => `${FRONTEND_URL}/student/rewards`,
  myRedemptions: () => `${FRONTEND_URL}/student/rewards/redemptions`,

  dailySpin: () => `${FRONTEND_URL}/student/daily-spin`,
  wallet: () => `${FRONTEND_URL}/student/wallet`,

  // Ochiq marketing sahifasi — courseId bilan ishlaydi (student ichki
  // /student/courses/:enrollmentId BUNGA mos kelmaydi, u yerda enrollmentId kerak)
  course: (courseId) => `${FRONTEND_URL}/courses/${courseId}`,

  // pdfPath — Certificate.pdfPath ("/uploads/certificates/xxx.pdf") — to'g'ridan-to'g'ri
  // PDF fayl havolasi (backend statik xizmatidan), frontend sahifasi emas
  certificatePdf: (pdfPath) => `${BACKEND_URL}${pdfPath}`,

  // Ikkalasi ham shart — faqat attemptId yetarli emas
  quizAttemptResult: (quizId, attemptId) => `${FRONTEND_URL}/student/quizzes/${quizId}/attempts/${attemptId}`,
  teacherQuizResults: (quizId) => `${FRONTEND_URL}/teacher/quizzes/${quizId}/results`,
  // "review" prefiksi yo'q — natijalar sahifasining o'zida, attemptId qo'shimcha segment sifatida
  reviewOpenEnded: (quizId, attemptId) => `${FRONTEND_URL}/teacher/quizzes/${quizId}/results/${attemptId}`,

  adminPendingUsers: () => `${FRONTEND_URL}/admin/users?tab=unverified`,
};

module.exports = { FRONTEND_URL, BACKEND_URL, frontendLinks };
