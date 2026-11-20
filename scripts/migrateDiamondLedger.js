// scripts/migrateDiamondLedger.js
// Olmos jurnali (DiamondTransaction) paydo bo'lishidan oldingi tarixni mavjud urinishlar,
// darslar, spinlar va sovg'a so'rovlaridan tiklaydi — GET /users/:id/diamond-history
// eski hodisalarni ham ko'rsatishi uchun. Batafsil qoidalar:
// src/modules/diamond-ledger/diamondLedger.migration.js
//
// Ishlatilishi (yangi kod deploy qilingandan KEYIN):
//   node scripts/migrateDiamondLedger.js          — faqat hisoblab ko'rsatadi (hech narsa yozilmaydi)
//   node scripts/migrateDiamondLedger.js --yes    — jurnalga yozadi
//
// Qayta ishga tushirish xavfsiz: migratsiya qilingan foydalanuvchilar o'tkazib yuboriladi.
// User.diamonds O'ZGARTIRILMAYDI — faqat jurnal yozuvlari qo'shiladi.

require('dotenv').config();
const mongoose = require('mongoose');

const { migrateAll } = require('../src/modules/diamond-ledger/diamondLedger.migration');

async function main() {
  const confirmed = process.argv.includes('--yes');

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`✅ Bazaga ulandi: ${mongoose.connection.name}`);
  console.log(confirmed ? "✍️  Rejim: YOZISH\n" : "👀 Rejim: sinov (hech narsa yozilmaydi)\n");

  const totals = await migrateAll({
    dryRun: !confirmed,
    onProgress: (t) => {
      if (t.users % 200 === 0) console.log(`   … ${t.users} ta foydalanuvchi ko'rildi`);
    },
  });

  console.log('\n📊 Natija:');
  console.log(`   Ko'rilgan foydalanuvchilar:     ${totals.users}`);
  console.log(`   Migratsiya qilingan:            ${totals.migrated}`);
  console.log(`   Allaqachon qilingan (o'tkazildi): ${totals.skipped}`);
  console.log(`   Tarixi yo'q:                    ${totals.empty}`);
  console.log(`   Jurnal yozuvlari:               ${totals.inserted}`);
  console.log(`   Farq tuzatilganlar (admin_adjust): ${totals.adjusted}`);

  if (!confirmed) {
    console.log("\nℹ️ Hech narsa yozilmadi. Yozish uchun: node scripts/migrateDiamondLedger.js --yes");
  }
}

main()
  .catch((err) => {
    console.error('❌ Migratsiya xatosi:', err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
