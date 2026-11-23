// scripts/unsetPaymentGatewayDebug.js
// Payment.gatewayDebug — eski vaqtinchalik diagnostika maydoni. Unda Multicard javobining
// xom shakli (to'lovchi telefoni/IP, merchant FIO/STIR/hisob raqami) saqlangan. Kod endi
// unga yozmaydi; bu skript bazadagi eski qiymatlarni o'chiradi.
//
// Ishlatilishi:
//   node scripts/unsetPaymentGatewayDebug.js        — faqat nechta yozuv borligini ko'rsatadi
//   node scripts/unsetPaymentGatewayDebug.js --yes  — o'chiradi (qaytarib bo'lmaydi)

require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const confirmed = process.argv.includes('--yes');

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`✅ Bazaga ulandi: ${mongoose.connection.name}`);

  // Model orqali emas, to'g'ridan-to'g'ri kolleksiya — sxemadan qat'i nazar ishlaydi
  const payments = mongoose.connection.collection('payments');
  const filter = { gatewayDebug: { $exists: true } };
  const count = await payments.countDocuments(filter);
  console.log(`📦 gatewayDebug bor yozuvlar: ${count} ta`);

  if (!confirmed) {
    console.log("ℹ️ Hech narsa o'zgartirilmadi. O'chirish uchun: node scripts/unsetPaymentGatewayDebug.js --yes");
    return;
  }

  const { modifiedCount } = await payments.updateMany(filter, { $unset: { gatewayDebug: '' } });
  console.log(`🧹 ${modifiedCount} ta yozuvdan gatewayDebug o'chirildi`);
}

main()
  .catch((err) => {
    console.error('❌ Xato:', err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
