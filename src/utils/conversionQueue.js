// src/utils/conversionQueue.js
// Video konvertatsiya (ffmpeg) og'ir CPU ishi — bir vaqtda faqat bitta konvertatsiya
// ishlashi uchun oddiy in-process FIFO navbat (Redis/Bull kerak emas, kichik platforma
// uchun yetarli). DIQQAT: bu xotirada saqlanadi — server qayta ishga tushsa, navbatdagi
// ishlar yo'qoladi (Lesson.videoStatus="processing" qolib ketishi mumkin, qayta
// yuklash/skript bilan tiklanadi).

const queue = [];
let active = false;

const processNext = async () => {
  if (active) return;
  const job = queue.shift();
  if (!job) return;

  active = true;
  try {
    await job();
  } catch (error) {
    console.error('Video konvertatsiya navbatida xato:', error.message);
  } finally {
    active = false;
    processNext();
  }
};

const enqueueConversion = (job) => {
  queue.push(job);
  processNext();
};

module.exports = { enqueueConversion };
