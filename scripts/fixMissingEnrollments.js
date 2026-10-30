// scripts/fixMissingEnrollments.js
// Ba'zi kurs to'lovlari (ayniqsa eski, 2026-10-30'dan oldingi 100% promokod bug'i
// tufayli) Payment status='success' bo'lib saqlangan, lekin Enrollment hech qachon
// yaratilmagan bo'lishi mumkin edi. Bu skript shunday "tiqilib qolgan" holatlarni
// topib, Enrollment'ni qo'lda yaratadi — moliyaviy ma'lumotga (Payment) tegmaydi.
//
// Ishlatilishi:
//   node scripts/fixMissingEnrollments.js          — faqat topilganlarni ko'rsatadi (hech narsa o'zgarmaydi)
//   node scripts/fixMissingEnrollments.js --yes    — topilgan Enrollment'larni yaratadi
//
// Productionga qarshi ishlatish uchun MONGO_URI'ni shu production bazaga
// ko'rsating (masalan .env'dagi qatorni vaqtincha almashtiring yoki):
//   MONGO_URI="mongodb+srv://..." node scripts/fixMissingEnrollments.js --yes

require('dotenv').config();
const mongoose = require('mongoose');

const Payment = require('../src/modules/payment/payment.model');
const Enrollment = require('../src/modules/enrollment/enrollment.model');

const ACTIVE_STATUSES = ['active', 'completed'];

async function main() {
  const confirmed = process.argv.includes('--yes');

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`✅ Bazaga ulandi: ${mongoose.connection.name}\n`);

  const payments = await Payment.find({ purpose: 'course', status: 'success', course: { $ne: null } })
    .populate('user', 'name phone')
    .populate('course', 'title');

  const broken = [];

  for (const payment of payments) {
    if (!payment.user || !payment.course) continue; // user/course o'chirilgan bo'lishi mumkin

    const enrollment = await Enrollment.findOne({ student: payment.user._id, course: payment.course._id });
    if (enrollment && ACTIVE_STATUSES.includes(enrollment.status)) continue; // hammasi joyida

    broken.push({ payment, enrollment });
  }

  if (!broken.length) {
    console.log("🎉 Hech qanday muammo topilmadi — barcha muvaffaqiyatli kurs to'lovlari uchun Enrollment mavjud.");
    await mongoose.disconnect();
    return;
  }

  console.log(`⚠️  ${broken.length} ta to'lov uchun faol Enrollment topilmadi:\n`);
  for (const { payment, enrollment } of broken) {
    console.log(
      `  - invoiceId=${payment.invoiceId} | student=${payment.user.name} (${payment.user.phone}) | ` +
        `course="${payment.course.title}" | enrollment=${enrollment ? `status=${enrollment.status}` : 'yo\'q'}`
    );
  }

  if (!confirmed) {
    console.log("\nℹ️  Hech narsa o'zgartirilmadi (quruq ishga tushirish). Tuzatish uchun oxiriga --yes qo'shing.");
    await mongoose.disconnect();
    return;
  }

  console.log('\n🔧 Tuzatilyapti...');
  for (const { payment, enrollment } of broken) {
    if (enrollment) {
      enrollment.status = 'active';
      enrollment.paymentRef = payment._id;
      enrollment.enrolledAt = enrollment.enrolledAt ?? payment.paymentTime ?? payment.createdAt;
      await enrollment.save();
    } else {
      await Enrollment.create({
        student: payment.user._id,
        course: payment.course._id,
        paymentRef: payment._id,
        enrolledAt: payment.paymentTime ?? payment.createdAt,
      });
    }
    console.log(`  ✅ invoiceId=${payment.invoiceId} — Enrollment tuzatildi`);
  }

  console.log(`\n🎉 ${broken.length} ta Enrollment tuzatildi.`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('❌ Kutilmagan xatolik:', error);
  process.exit(1);
});
