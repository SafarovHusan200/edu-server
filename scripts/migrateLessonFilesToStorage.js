// scripts/migrateLessonFilesToStorage.js
// 2026-10-31'dagi xavfsizlik o'zgarishi: dars video/materiallari endi ochiq
// public/uploads/lessons papkasida emas, himoyalangan storage/lessons papkasida saqlanadi
// (GET /media/lessons/:file orqali, imzolangan havola bilan beriladi). Bu skript eski
// serverlarda uploads/lessons'da qolib ketgan fayllarni storage/lessons'ga ko'chiradi.
// DB'dagi Lesson.videoUrl / attachments qiymatlari O'ZGARMAYDI — ular hamon
// "/uploads/lessons/<fayl>" ko'rinishida turadi, fayl nomi orqali topiladi
// (src/middleware/upload.js: toProtectedPath / src/utils/mediaSigning.js).
//
// Ishlatilishi:
//   node scripts/migrateLessonFilesToStorage.js          — faqat nima ko'chirilishini ko'rsatadi
//   node scripts/migrateLessonFilesToStorage.js --yes    — fayllarni haqiqatan ko'chiradi

const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, '..', 'uploads', 'lessons');
const DEST_DIR = path.join(__dirname, '..', 'storage', 'lessons');

function main() {
  const confirmed = process.argv.includes('--yes');

  if (!fs.existsSync(SOURCE_DIR)) {
    console.log(`ℹ️  ${SOURCE_DIR} mavjud emas — ko'chiradigan hech narsa yo'q.`);
    return;
  }

  const files = fs.readdirSync(SOURCE_DIR).filter((name) => {
    return fs.statSync(path.join(SOURCE_DIR, name)).isFile();
  });

  if (!files.length) {
    console.log("🎉 uploads/lessons bo'sh — ko'chiradigan fayl yo'q.");
    return;
  }

  console.log(`⚠️  ${files.length} ta fayl topildi (uploads/lessons -> storage/lessons):\n`);
  for (const file of files) {
    console.log(`  - ${file}`);
  }

  if (!confirmed) {
    console.log("\nℹ️  Hech narsa ko'chirilmadi (quruq ishga tushirish). Ko'chirish uchun oxiriga --yes qo'shing.");
    return;
  }

  fs.mkdirSync(DEST_DIR, { recursive: true });

  console.log('\n🔧 Ko\'chirilyapti...');
  let moved = 0;
  for (const file of files) {
    const from = path.join(SOURCE_DIR, file);
    const to = path.join(DEST_DIR, file);

    if (fs.existsSync(to)) {
      console.log(`  ⏭  ${file} — storage/lessons'da allaqachon bor, o'tkazib yuborildi`);
      continue;
    }

    fs.renameSync(from, to);
    moved += 1;
    console.log(`  ✅ ${file}`);
  }

  console.log(`\n🎉 ${moved} ta fayl ko'chirildi. DB'dagi yo'llar o'zgarmadi.`);
}

main();
