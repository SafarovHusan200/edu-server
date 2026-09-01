// src/config/frontendLinks.js
// Bildirishnomalarda (in-app va Telegram) foydalanuvchini frontenddagi tegishli
// sahifaga to'g'ridan-to'g'ri olib boradigan havolalar — bitta joyda saqlanadi,
// shunda frontend routing o'zgarsa faqat shu faylni yangilash kifoya.
//
// DIQQAT: quyidagi yo'llarning ba'zilari (masalan attemptResult, teacherQuizResults)
// frontendda hali mavjud bo'lmasligi mumkin — frontend jamoasi bilan tekshirib,
// haqiqiy route'larga moslashtiring. premium va rewards yo'llari mavjud sahifalar
// bilan tasdiqlangan (Multicard return_url va skrinshotlardan).

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
  myRedemptions: () => `${FRONTEND_URL}/student/rewards?tab=my`,

  dailySpin: () => `${FRONTEND_URL}/student/daily-spin`,
  wallet: () => `${FRONTEND_URL}/wallet`,

  course: (courseId) => `${FRONTEND_URL}/courses/${courseId}`,

  // pdfPath — Certificate.pdfPath ("/uploads/certificates/xxx.pdf") — to'g'ridan-to'g'ri
  // PDF fayl havolasi (backend statik xizmatidan), frontend sahifasi emas
  certificatePdf: (pdfPath) => `${BACKEND_URL}${pdfPath}`,

  quizAttemptResult: (attemptId) => `${FRONTEND_URL}/student/attempts/${attemptId}`,
  teacherQuizResults: (quizId) => `${FRONTEND_URL}/teacher/quizzes/${quizId}/results`,
  reviewOpenEnded: (attemptId) => `${FRONTEND_URL}/teacher/attempts/${attemptId}/review`,

  adminPendingUsers: () => `${FRONTEND_URL}/admin/users?isVerified=false`,
};

module.exports = { FRONTEND_URL, BACKEND_URL, frontendLinks };
