// scripts/restoreBackup.js
// Zaxira faylidan (dbBackup.service.js yaratgan .json.gz) ma'lumotlarni bazaga
// qo'lda tiklaydi. BU DESTRUKTIV AMAL — har bir kolleksiyani avval TO'LIQ
// tozalab, keyin zaxiradagi hujjatlarni qayta yozadi. Avtomatik ishga
// tushirilmaydi — faqat inson tomonidan, ataylab chaqirilishi kerak.
//
// Ishlatilishi:
//   node scripts/restoreBackup.js <backup-fayl.json.gz> --yes
//
// --yes bayrog'isiz skript faqat nima qilishini ko'rsatib, hech narsani
// o'zgartirmasdan to'xtaydi (xavfsizlik uchun "quruq ishga tushirish").

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const mongoose = require('mongoose');

// Barcha modellarni ro'yxatdan o'tkazish uchun — routes barcha modul fayllarini
// (demak barcha model fayllarini ham) transitiv ravishda require qiladi
require('../src/routes');

async function main() {
  const filePath = process.argv[2];
  const confirmed = process.argv.includes('--yes');

  if (!filePath) {
    console.error('Ishlatilishi: node scripts/restoreBackup.js <backup-fayl.json.gz> --yes');
    process.exit(1);
  }

  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ Fayl topilmadi: ${absolutePath}`);
    process.exit(1);
  }

  const compressed = fs.readFileSync(absolutePath);
  const json = zlib.gunzipSync(compressed).toString('utf-8');
  const { collections, exportedAt } = JSON.parse(json);

  console.log(`📦 Zaxira sanasi: ${exportedAt}`);
  console.log(`📁 Fayl: ${absolutePath}`);
  console.log(`📊 Kolleksiyalar: ${Object.keys(collections).join(', ')}`);
  console.log(
    "\n⚠️  DIQQAT: bu amal quyidagi kolleksiyalarni TO'LIQ o'chirib, zaxiradagi " +
      "ma'lumot bilan almashtiradi. Bu QAYTARIB BO'LMAYDIGAN amal.\n" +
      "⚠️  Foydalanuvchi parollari zaxirada YO'Q (xavfsizlik uchun eksport qilinmagan) — " +
      "tiklangan foydalanuvchilar parolsiz qoladi, faqat Telegram orqali kirib, " +
      "keyin parolni qayta o'rnatishlari kerak bo'ladi.\n"
  );

  if (!confirmed) {
    console.log("ℹ️  Hech narsa o'zgartirilmadi (quruq ishga tushirish). Tasdiqlash uchun oxiriga --yes qo'shing.");
    process.exit(0);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Bazaga ulandi\n');

  // Kolleksiya nomi ("users") -> shu kolleksiyaga mos Mongoose modeli
  const modelByCollection = new Map(
    mongoose.modelNames().map((name) => [mongoose.model(name).collection.collectionName, mongoose.model(name)])
  );

  for (const [collectionName, docs] of Object.entries(collections)) {
    if (!docs.length) {
      console.log(`⏭️  ${collectionName}: bo'sh, o'tkazib yuborildi`);
      continue;
    }

    const Model = modelByCollection.get(collectionName);
    if (!Model) {
      console.warn(`⚠️  ${collectionName}: mos model topilmadi, o'tkazib yuborildi`);
      continue;
    }

    try {
      await Model.deleteMany({});
      // Model.insertMany (raw collection.insertMany emas) — sxema orqali
      // ObjectId/Date kabi turlar to'g'ri "cast" qilinishi uchun
      await Model.insertMany(docs, { ordered: false });
      console.log(`✅ ${collectionName}: ${docs.length} ta hujjat tiklandi`);
    } catch (error) {
      console.error(`❌ ${collectionName}: xatolik — ${error.message}`);
    }
  }

  console.log('\n🎉 Tiklash yakunlandi.');
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('❌ Kutilmagan xatolik:', error);
  process.exit(1);
});
