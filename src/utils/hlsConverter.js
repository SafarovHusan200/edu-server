// src/utils/hlsConverter.js
// Darsning asosiy mp4 videosini HLS (AES-128 shifrlangan, 2 sifat: 480p/720p) ko'rinishiga
// o'girish. ffmpeg binary PATH'da bo'lishi kerak (yoki FFMPEG_PATH .env orqali ko'rsatilsin).
// Diskdagi .m3u8 fayllar XOM (imzosiz, nisbiy yo'llar bilan) saqlanadi — key.bin/segment/
// variant playlist havolalari har bir so'rovda src/modules/media/hls.controller.js tomonidan
// so'rov yuborgan foydalanuvchiga xos imzolangan havolaga aylantiriladi.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { STORAGE_ROOT } = require('../middleware/upload');

const HLS_STORAGE_DIR = path.join(STORAGE_ROOT, 'hls');
const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';

// [papka nomi, kenglik:balandlik, video bitrate] — kam quvvatli ulanishlar uchun 480p,
// yaxshi internet uchun 720p (HLS avtomatik moslashtiradi, ABR)
const RENDITIONS = [
  { name: '480p', scale: '854:480', videoBitrate: '800k', bandwidth: 800000, resolution: '854x480' },
  { name: '720p', scale: '1280:720', videoBitrate: '1800k', bandwidth: 1800000, resolution: '1280x720' },
];

const lessonHlsDir = (lessonId) => path.join(HLS_STORAGE_DIR, String(lessonId));

const runFfmpeg = (args) =>
  new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_BIN, args);
    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('error', (error) => reject(error)); // masalan ENOENT — ffmpeg o'rnatilmagan
    proc.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg ${code} bilan tugadi:\n${stderr.slice(-2000)}`));
    });
  });

// Bitta lessonId uchun oldin yaratilgan HLS fayllarini butunlay o'chiradi (video
// almashtirilganda yoki dars o'chirilganda eski bo'laklar qolib ketmasligi uchun)
const deleteHlsOutput = (lessonId) => {
  const dir = lessonHlsDir(lessonId);
  fs.rm(dir, { recursive: true, force: true }, (error) => {
    if (error) console.error('HLS papkasini o\'chirishda xato:', error.message);
  });
};

// sourceAbsolutePath — storage/lessons/<fayl>.mp4 (haqiqiy fayl yo'li). Natija: dir ichida
// key.bin, 480p/playlist.m3u8 + seg*.ts, 720p/playlist.m3u8 + seg*.ts, master.m3u8
const convertLessonVideo = async (lessonId, sourceAbsolutePath) => {
  const dir = lessonHlsDir(lessonId);
  await fs.promises.rm(dir, { recursive: true, force: true });
  await fs.promises.mkdir(dir, { recursive: true });

  const keyPath = path.join(dir, 'key.bin');
  await fs.promises.writeFile(keyPath, crypto.randomBytes(16));

  const keyInfoPath = path.join(dir, 'keyinfo.txt');
  // 1-qator: .m3u8 ichiga yoziladigan (keyin qayta yoziladigan) URI, 2-qator: ffmpeg
  // shifrlash uchun o'qiydigan haqiqiy fayl yo'li
  await fs.promises.writeFile(keyInfoPath, `key.bin\n${keyPath}\n`);

  for (const rendition of RENDITIONS) {
    const renditionDir = path.join(dir, rendition.name);
    await fs.promises.mkdir(renditionDir, { recursive: true });

    await runFfmpeg([
      '-y',
      '-i', sourceAbsolutePath,
      '-vf', `scale=${rendition.scale}`,
      '-c:v', 'libx264',
      '-b:v', rendition.videoBitrate,
      '-c:a', 'aac',
      '-b:a', '128k',
      '-hls_time', '6',
      '-hls_playlist_type', 'vod',
      '-hls_key_info_file', keyInfoPath,
      '-hls_segment_filename', path.join(renditionDir, 'seg%d.ts'),
      path.join(renditionDir, 'playlist.m3u8'),
    ]);
  }

  await fs.promises.unlink(keyInfoPath);

  const masterLines = [
    '#EXTM3U',
    ...RENDITIONS.flatMap((r) => [
      `#EXT-X-STREAM-INF:BANDWIDTH=${r.bandwidth},RESOLUTION=${r.resolution}`,
      `${r.name}/playlist.m3u8`,
    ]),
  ];
  await fs.promises.writeFile(path.join(dir, 'master.m3u8'), masterLines.join('\n') + '\n');
};

module.exports = {
  HLS_STORAGE_DIR,
  RENDITIONS,
  lessonHlsDir,
  convertLessonVideo,
  deleteHlsOutput,
};
