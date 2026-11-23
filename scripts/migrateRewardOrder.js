// scripts/migrateRewardOrder.js
// Reward.order maydoni paydo bo'lishidan oldingi sovg'alarga boshlang'ich tartib beradi:
// createdAt kamayish bo'yicha (yangisi oldinda) order = 0, 1, 2, ...
// Mantiq: src/migrations/rewardOrder.js (deploy'da `npm run migrate` ham shuni ishlatadi)
//
// Ishlatilishi:
//   node scripts/migrateRewardOrder.js          — faqat ko'rsatadi (hech narsa yozilmaydi)
//   node scripts/migrateRewardOrder.js --yes    — yozadi
//
// Admin tartibni allaqachon o'zgartirgan bo'lsa (biror sovg'ada order != 0), skript uni
// buzmaslik uchun to'xtaydi. Baribir qayta yozish kerak bo'lsa: --yes --force

require('dotenv').config();
const mongoose = require('mongoose');

const { migrateRewardOrder } = require('../src/migrations/rewardOrder');

async function main() {
  const confirmed = process.argv.includes('--yes');
  const force = process.argv.includes('--force');

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`✅ Bazaga ulandi: ${mongoose.connection.name}`);
  console.log(confirmed ? "✍️  Rejim: YOZISH\n" : "👀 Rejim: sinov (hech narsa yozilmaydi)\n");

  const result = await migrateRewardOrder({ dryRun: !confirmed, force });

  if (result.skipped) {
    console.log(
      `⏭️  ${result.alreadyOrdered} ta sovg'ada tartib allaqachon belgilangan — o'tkazib yuborildi.\n` +
        "   Baribir createdAt bo'yicha qayta yozish uchun: --yes --force"
    );
    return;
  }

  result.rewards.forEach((r, i) => console.log(`   ${String(i).padStart(3)}  ${r.title}`));

  if (!confirmed) {
    console.log(`\nℹ️ ${result.rewards.length} ta sovg'a. Yozish uchun: node scripts/migrateRewardOrder.js --yes`);
    return;
  }
  console.log(`\n✅ ${result.updated} ta sovg'aga tartib berildi`);
}

main()
  .catch((err) => {
    console.error('❌ Migratsiya xatosi:', err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
