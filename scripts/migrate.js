// scripts/migrate.js — `npm run migrate`
// Deploy'da (.github/workflows/deploy.yml) har safar, server qayta ishga tushishidan OLDIN
// ishga tushadi. Shuning uchun bu yerga faqat QAYTA ISHGA TUSHIRISH XAVFSIZ (idempotent) va
// ma'lumotni o'chirmaydigan migratsiyalar qo'shiladi. Bir martalik / o'chiruvchi skriptlar
// (masalan unsetPaymentGatewayDebug, migrateDiamondLedger) bu yerga qo'shilmaydi —
// ular qo'lda, --yes bilan ishga tushiriladi.
//
// Xato bo'lsa — 1 kod bilan chiqadi va deploy to'xtaydi (eski versiya ishlashda davom etadi).

require('dotenv').config();
const mongoose = require('mongoose');

const { migrateRewardOrder } = require('../src/migrations/rewardOrder');

const MIGRATIONS = [
  {
    name: 'reward-order',
    run: async () => {
      const r = await migrateRewardOrder();
      return r.skipped ? "allaqachon qilingan" : `${r.updated} ta sovg'aga tartib berildi`;
    },
  },
];

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`✅ Migratsiyalar: ${mongoose.connection.name} bazasi`);

  for (const migration of MIGRATIONS) {
    const summary = await migration.run();
    console.log(`   • ${migration.name}: ${summary}`);
  }
}

main()
  .catch((err) => {
    console.error('❌ Migratsiya xatosi:', err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
