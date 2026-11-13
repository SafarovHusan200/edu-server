// scripts/expireDraftPayments.js
// Yig'ilib qolgan eski "draft" to'lovlarni bir martada tozalash uchun (cron har 30 daqiqada
// faqat DRAFT_CLEANUP_BATCH tadan ishlaydi — bu skript butun zaxirani bir yo'la o'tkazadi).
// Har bir draft avval Multicard'da tekshiriladi: aslida to'langan bo'lsa 'success' bo'ladi
// va natija (balans/premium/kurs) beriladi, to'lanmaganlari 'expired' qilinadi.
// Hech bir yozuv O'CHIRILMAYDI.
//
// Ishlatilishi:
//   node scripts/expireDraftPayments.js          — faqat nechta draft borligini ko'rsatadi (hech narsa o'zgarmaydi)
//   node scripts/expireDraftPayments.js --yes    — Multicard'da tekshirib, tozalaydi
//
// Productionga qarshi ishlatish uchun MONGO_URI va MULTICARD_* o'zgaruvchilari
// production qiymatlarida bo'lishi kerak (aks holda dev Multicard'dan so'raladi).

require('dotenv').config();
const mongoose = require('mongoose');

const Payment = require('../src/modules/payment/payment.model');
const { expireStaleDrafts } = require('../src/modules/payment/payment.service');
const { DRAFT_EXPIRE_MINUTES } = require('../src/config/payment');

async function main() {
  const confirmed = process.argv.includes('--yes');

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`✅ Bazaga ulandi: ${mongoose.connection.name}\n`);

  const cutoff = new Date(Date.now() - DRAFT_EXPIRE_MINUTES * 60 * 1000);
  const total = await Payment.countDocuments({ status: 'draft', createdAt: { $lt: cutoff } });
  console.log(`📋 ${DRAFT_EXPIRE_MINUTES} daqiqadan eski draft to'lovlar: ${total} ta`);

  if (!confirmed) {
    console.log("\nℹ️ Hech narsa o'zgartirilmadi. Tozalash uchun: node scripts/expireDraftPayments.js --yes");
    return;
  }

  const totals = { checked: 0, expired: 0, succeeded: 0, otherStatus: 0, failed: 0 };

  // Partiyalab, toki tekshirilmagan draft qolmaguncha. Multicard xato bergan draftlar
  // 'draft' bo'lib qoladi — cheksiz aylanmaslik uchun faqat oldinga siljiganda davom etamiz.
  for (;;) {
    const r = await expireStaleDrafts({ batch: 100 });
    Object.keys(totals).forEach((k) => (totals[k] += r[k]));
    console.log(`  … ${totals.checked} ta tekshirildi`);
    if (r.checked === 0 || r.checked === r.failed) break;
  }

  console.log('\n✅ Tayyor:');
  console.log(`   expired qilindi:          ${totals.expired}`);
  console.log(`   aslida to'langan (success): ${totals.succeeded}`);
  console.log(`   boshqa holatga o'tdi:     ${totals.otherStatus}`);
  console.log(`   Multicard xatosi (qoldi): ${totals.failed}`);
}

main()
  .catch((err) => {
    console.error('❌ Xato:', err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
