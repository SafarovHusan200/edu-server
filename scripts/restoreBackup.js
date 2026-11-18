// scripts/restoreBackup.js
// Zaxira faylidan (dbBackup.service.js yaratgan .json.gz) ma'lumotlarni bazaga
// qo'lda tiklaydi. BU DESTRUKTIV AMAL — har bir kolleksiyani avval TO'LIQ
// tozalab, keyin zaxiradagi hujjatlarni qayta yozadi. Avtomatik ishga
// tushirilmaydi — faqat inson tomonidan, ataylab chaqirilishi kerak.
//
// Ishlatilishi:
//   node scripts/restoreBackup.js <backup-fayl.json.gz> --yes
//   # katta zaxira bo'laklarga bo'lingan bo'lsa (backup-...json.gz.part1-of-3 va h.k.) —
//   # bo'laklarni bitta papkaga saqlab, asosiy nomni bering; skript ularni o'zi topib birlashtiradi:
//   node scripts/restoreBackup.js backup-2026-11-18.json.gz --yes
//   # yoki bo'laklarni bittalab sanab bering (tartib muhim emas)
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

const PART_PATTERN = /\.part(\d+)-of-(\d+)$/;

// Bitta fayl yoki "<nom>.partK-of-N" bo'laklari -> bitta gzip buffer.
// Bo'laklar raqami bo'yicha tartiblanadi, to'liqligi tekshiriladi.
// Asosiy nom (backup-<sana>.json.gz) berilib, fayl o'zi yo'q bo'lsa — yonidagi
// "<nom>.partK-of-N" bo'laklarini qidiradi (Windows shell'i part* glob'ni ochmaydi)
const findParts = (absolutePath) => {
  const dir = path.dirname(absolutePath);
  const base = path.basename(absolutePath);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.startsWith(`${base}.part`) && PART_PATTERN.test(name))
    .map((name) => path.join(dir, name));
};

const readBackupFiles = (filePaths) => {
  let absolutePaths = filePaths.map((p) => path.resolve(p));
  if (absolutePaths.length === 1 && !fs.existsSync(absolutePaths[0]) && !PART_PATTERN.test(absolutePaths[0])) {
    const parts = findParts(absolutePaths[0]);
    if (parts.length) absolutePaths = parts;
  }
  const missing = absolutePaths.filter((p) => !fs.existsSync(p));
  if (missing.length) throw new Error(`Fayl topilmadi: ${missing.join(', ')}`);

  if (absolutePaths.length === 1 && !PART_PATTERN.test(absolutePaths[0])) {
    return { buffer: fs.readFileSync(absolutePaths[0]), label: absolutePaths[0] };
  }

  const parts = absolutePaths.map((p) => {
    const match = p.match(PART_PATTERN);
    if (!match) throw new Error(`Bo'lak nomi ".partK-of-N" bilan tugashi kerak: ${p}`);
    return { file: p, index: Number(match[1]), total: Number(match[2]), base: p.replace(PART_PATTERN, '') };
  });

  const { total, base } = parts[0];
  if (parts.some((p) => p.total !== total || p.base !== base)) {
    throw new Error("Bo'laklar turli zaxiralarga tegishli (nomi yoki jami soni mos emas)");
  }
  parts.sort((a, b) => a.index - b.index);
  const indexes = parts.map((p) => p.index).join(',');
  const expected = Array.from({ length: total }, (_, i) => i + 1).join(',');
  if (indexes !== expected) {
    throw new Error(`Bo'laklar to'liq emas: kerak 1..${total}, berilgan ${indexes}`);
  }

  return {
    buffer: Buffer.concat(parts.map((p) => fs.readFileSync(p.file))),
    label: `${base} (${total} ta bo'lak)`,
  };
};

async function main() {
  const filePaths = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const confirmed = process.argv.includes('--yes');

  if (!filePaths.length) {
    console.error('Ishlatilishi: node scripts/restoreBackup.js <backup-fayl.json.gz | bo\'laklar...> --yes');
    process.exit(1);
  }

  let compressed;
  let absolutePath;
  try {
    ({ buffer: compressed, label: absolutePath } = readBackupFiles(filePaths));
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }

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

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Kutilmagan xatolik:', error);
    process.exit(1);
  });
}

module.exports = { readBackupFiles };
