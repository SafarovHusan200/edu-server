// scripts/convertExistingLessonVideos.js
// 2026-11-02'dagi HLS+AES-128 o'zgarishidan OLDIN yuklangan dars videolari hamon xom mp4
// (Lesson.videoStatus="none") — bu skript ularni ffmpeg bilan HLS'ga o'tkazadi va
// videoStatus="ready" qilib belgilaydi. ffmpeg PATH'da bo'lishi SHART (yoki .env'da
// FFMPEG_PATH ko'rsatilgan bo'lsin) — serverda o'rnatilganini oldin tekshiring:
//   ffmpeg -version
//
// Ishlatilishi:
//   node scripts/convertExistingLessonVideos.js          — qaysi darslar konvertatsiya
//                                                            qilinishini ko'rsatadi
//   node scripts/convertExistingLessonVideos.js --yes    — haqiqatan konvertatsiya qiladi
//                                                            (ketma-ket, bittadan)

require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');

const Lesson = require('../src/modules/lessons/lesson.model');
const { LESSON_FILE_PREFIX } = require('../src/utils/mediaSigning');
const { LESSONS_STORAGE_DIR } = require('../src/middleware/upload');
const { convertLessonVideo } = require('../src/utils/hlsConverter');

async function main() {
  const confirmed = process.argv.includes('--yes');

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`✅ Bazaga ulandi: ${mongoose.connection.name}\n`);

  const lessons = await Lesson.find({
    videoUrl: { $regex: `^${LESSON_FILE_PREFIX}` },
    videoStatus: { $ne: 'ready' },
  }).select('_id title videoUrl videoStatus');

  if (!lessons.length) {
    console.log("🎉 Konvertatsiya qilinadigan dars yo'q — hammasi allaqachon HLS'da.");
    await mongoose.disconnect();
    return;
  }

  console.log(`⚠️  ${lessons.length} ta dars videosi konvertatsiya qilinadi:\n`);
  for (const lesson of lessons) {
    console.log(`  - ${lesson._id} | "${lesson.title}" (hozirgi holat: ${lesson.videoStatus})`);
  }

  if (!confirmed) {
    console.log("\nℹ️  Hech narsa qilinmadi (quruq ishga tushirish). Boshlash uchun oxiriga --yes qo'shing.");
    await mongoose.disconnect();
    return;
  }

  console.log('\n🔧 Konvertatsiya boshlandi (ketma-ket, bittadan — biroz vaqt olishi mumkin)...\n');

  let done = 0;
  let failed = 0;

  for (const lesson of lessons) {
    const filename = path.basename(lesson.videoUrl);
    const absolutePath = path.join(LESSONS_STORAGE_DIR, filename);

    try {
      await Lesson.findByIdAndUpdate(lesson._id, { videoStatus: 'processing' });
      await convertLessonVideo(lesson._id, absolutePath);
      await Lesson.findByIdAndUpdate(lesson._id, { videoStatus: 'ready' });
      console.log(`  ✅ ${lesson._id} | "${lesson.title}"`);
      done += 1;
    } catch (error) {
      await Lesson.findByIdAndUpdate(lesson._id, { videoStatus: 'failed' });
      console.log(`  ❌ ${lesson._id} | "${lesson.title}" — ${error.message}`);
      failed += 1;
    }
  }

  console.log(`\n🎉 Tugadi: ${done} muvaffaqiyatli, ${failed} xato.`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('❌ Kutilmagan xatolik:', error);
  process.exit(1);
});
