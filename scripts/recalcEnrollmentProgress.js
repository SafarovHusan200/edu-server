// scripts/recalcEnrollmentProgress.js
// Enrollment.progress maydoni 2026-10-31'da qo'shildi — shu sanadan oldin yaratilgan
// (yoki darslari tugatilgan) enrollment'larda progress hali 0 (default) qiymatda qolgan,
// chunki ular /lessons/:id/complete orqali qayta hisoblanmagan. Bu skript barcha
// enrollment'lar uchun progress = round(completedLessons.length / kursdagi darslar soni * 100)
// formulasi bo'yicha qayta hisoblaydi.
//
// Ishlatilishi:
//   node scripts/recalcEnrollmentProgress.js          — faqat o'zgaradiganlarni ko'rsatadi
//   node scripts/recalcEnrollmentProgress.js --yes    — progress'larni yangilaydi

require('dotenv').config();
const mongoose = require('mongoose');

const Enrollment = require('../src/modules/enrollment/enrollment.model');
const Lesson = require('../src/modules/lessons/lesson.model');

async function main() {
  const confirmed = process.argv.includes('--yes');

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`✅ Bazaga ulandi: ${mongoose.connection.name}\n`);

  const enrollments = await Enrollment.find().populate('student', 'name phone').populate('course', 'title');

  const mismatched = [];

  for (const enrollment of enrollments) {
    if (!enrollment.course) continue; // kurs o'chirilgan bo'lishi mumkin

    const totalLessons = await Lesson.countDocuments({ course: enrollment.course._id });
    const correctProgress =
      totalLessons > 0 ? Math.round((enrollment.completedLessons.length / totalLessons) * 100) : 0;

    if (correctProgress !== enrollment.progress) {
      mismatched.push({ enrollment, correctProgress });
    }
  }

  if (!mismatched.length) {
    console.log("🎉 Hech qanday nomuvofiqlik topilmadi — barcha enrollment'larda progress to'g'ri.");
    await mongoose.disconnect();
    return;
  }

  console.log(`⚠️  ${mismatched.length} ta enrollment'da progress noto'g'ri:\n`);
  for (const { enrollment, correctProgress } of mismatched) {
    console.log(
      `  - student=${enrollment.student?.name ?? '?'} | course="${enrollment.course.title}" | ` +
        `hozirgi=${enrollment.progress} -> to'g'ri=${correctProgress}`
    );
  }

  if (!confirmed) {
    console.log("\nℹ️  Hech narsa o'zgartirilmadi (quruq ishga tushirish). Tuzatish uchun oxiriga --yes qo'shing.");
    await mongoose.disconnect();
    return;
  }

  console.log('\n🔧 Tuzatilyapti...');
  for (const { enrollment, correctProgress } of mismatched) {
    enrollment.progress = correctProgress;
    await enrollment.save();
  }

  console.log(`\n🎉 ${mismatched.length} ta enrollment'ning progress'i tuzatildi.`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('❌ Kutilmagan xatolik:', error);
  process.exit(1);
});
