// scripts/migrateRewardOrder.js
// Reward.order maydoni paydo bo'lishidan oldingi sovg'alarga boshlang'ich tartib beradi:
// createdAt kamayish bo'yicha (yangisi oldinda) order = 0, 1, 2, ...
//
// Ishlatilishi (yangi kod deploy qilingandan KEYIN):
//   node scripts/migrateRewardOrder.js          — faqat ko'rsatadi (hech narsa yozilmaydi)
//   node scripts/migrateRewardOrder.js --yes    — yozadi
//
// Admin tartibni allaqachon o'zgartirgan bo'lsa (biror sovg'ada order != 0), skript uni
// buzmaslik uchun to'xtaydi. Baribir qayta yozish kerak bo'lsa: --yes --force

require('dotenv').config();
const mongoose = require('mongoose');

const Reward = require('../src/modules/rewards/reward.model');

async function main() {
  const confirmed = process.argv.includes('--yes');
  const force = process.argv.includes('--force');

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`✅ Bazaga ulandi: ${mongoose.connection.name}`);
  console.log(confirmed ? "✍️  Rejim: YOZISH\n" : "👀 Rejim: sinov (hech narsa yozilmaydi)\n");

  const alreadyOrdered = await Reward.countDocuments({ order: { $nin: [0, null] } });
  if (alreadyOrdered > 0 && !force) {
    console.log(
      `⏭️  ${alreadyOrdered} ta sovg'ada tartib allaqachon belgilangan — o'tkazib yuborildi.\n` +
        "   Baribir createdAt bo'yicha qayta yozish uchun: --yes --force"
    );
    return;
  }

  const rewards = await Reward.find().sort({ createdAt: -1 }).select('_id title createdAt').lean();
  rewards.forEach((r, i) => console.log(`   ${String(i).padStart(3)}  ${r.title}`));

  if (!confirmed) {
    console.log(`\nℹ️ ${rewards.length} ta sovg'a. Yozish uchun: node scripts/migrateRewardOrder.js --yes`);
    return;
  }

  if (rewards.length > 0) {
    await Reward.bulkWrite(
      rewards.map((r, i) => ({
        updateOne: { filter: { _id: r._id }, update: { $set: { order: i } } },
      }))
    );
  }
  console.log(`\n✅ ${rewards.length} ta sovg'aga tartib berildi`);
}

main()
  .catch((err) => {
    console.error('❌ Migratsiya xatosi:', err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
