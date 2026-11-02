// src/modules/media/hls.controller.js
// HLS (AES-128 shifrlangan) dars videosini beradi. master/variant playlist va segmentlar
// imzolangan havola (exp/uid/sig) orqali — xuddi media.controller.js'dagi mp4/pdf kabi.
// Shifrlash kaliti (key.bin) BUNDAN FARQLI — faqat Authorization: Bearer <token> bilan,
// har safar jonli (DB'dan) kursga yozilganlik tekshiruvi orqali beriladi (src/utils/
// hlsConverter.js kalitni yaratadi, mediaSigning.js imzolarni tekshiradi).

const fs = require('fs');
const path = require('path');
const { lessonHlsDir } = require('../../utils/hlsConverter');
const { verifyHlsSignature, signHlsResource, isAllowedMediaOrigin } = require('../../utils/mediaSigning');
const Lesson = require('../lessons/lesson.model');
const Course = require('../courses/course.model');
const courseService = require('../courses/course.service');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');

const LESSON_ID_PATTERN = /^[0-9a-fA-F]{24}$/;
const VARIANTS = ['480p', '720p'];
const SEGMENT_FILENAME_PATTERN = /^[\w-]+\.ts$/;

const keyUrl = (lessonId) => `/api/v1/media/hls/${lessonId}/key`;

const rewriteMasterPlaylist = (content, lessonId, uid) =>
  content
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;
      return signHlsResource(lessonId, trimmed, uid);
    })
    .join('\n');

const rewriteVariantPlaylist = (content, lessonId, variant, uid) =>
  content
    .split('\n')
    .map((line) => {
      if (line.startsWith('#EXT-X-KEY')) {
        return line.replace(/URI="key\.bin"/, `URI="${keyUrl(lessonId)}"`);
      }
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;
      return signHlsResource(lessonId, `${variant}/seg/${trimmed}`, uid);
    })
    .join('\n');

const readFileOr404 = async (absolutePath) => {
  try {
    return await fs.promises.readFile(absolutePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') throw new ApiError(404, 'Fayl topilmadi');
    throw error;
  }
};

// GET /api/v1/media/hls/:lessonId/master.m3u8?exp&uid&sig
const getMasterPlaylist = asyncHandler(async (req, res) => {
  const { lessonId } = req.params;
  const { exp, uid, sig } = req.query;

  if (!LESSON_ID_PATTERN.test(lessonId)) throw new ApiError(404, 'Dars topilmadi');
  if (!isAllowedMediaOrigin(req)) throw new ApiError(403, "Ruxsat yo'q (noto'g'ri manba)");
  if (!verifyHlsSignature({ lessonId, resourcePath: 'master.m3u8', exp, uid, sig })) {
    throw new ApiError(403, "Havola muddati o'tgan yoki imzo noto'g'ri");
  }

  const content = await readFileOr404(path.join(lessonHlsDir(lessonId), 'master.m3u8'));

  res.set('Content-Type', 'application/vnd.apple.mpegurl');
  res.set('Cache-Control', 'no-store');
  res.send(rewriteMasterPlaylist(content, lessonId, uid));
});

// GET /api/v1/media/hls/:lessonId/:variant/playlist.m3u8?exp&uid&sig
const getVariantPlaylist = asyncHandler(async (req, res) => {
  const { lessonId, variant } = req.params;
  const { exp, uid, sig } = req.query;

  if (!LESSON_ID_PATTERN.test(lessonId) || !VARIANTS.includes(variant)) {
    throw new ApiError(404, 'Topilmadi');
  }

  const resourcePath = `${variant}/playlist.m3u8`;
  if (!isAllowedMediaOrigin(req)) throw new ApiError(403, "Ruxsat yo'q (noto'g'ri manba)");
  if (!verifyHlsSignature({ lessonId, resourcePath, exp, uid, sig })) {
    throw new ApiError(403, "Havola muddati o'tgan yoki imzo noto'g'ri");
  }

  const content = await readFileOr404(path.join(lessonHlsDir(lessonId), variant, 'playlist.m3u8'));

  res.set('Content-Type', 'application/vnd.apple.mpegurl');
  res.set('Cache-Control', 'no-store');
  res.send(rewriteVariantPlaylist(content, lessonId, variant, uid));
});

// GET /api/v1/media/hls/:lessonId/:variant/seg/:filename?exp&uid&sig — Range kerak emas,
// bo'lak har doim 6 soniyalik to'liq fayl sifatida yuboriladi
const getSegment = asyncHandler(async (req, res) => {
  const { lessonId, variant, filename } = req.params;
  const { exp, uid, sig } = req.query;

  if (
    !LESSON_ID_PATTERN.test(lessonId) ||
    !VARIANTS.includes(variant) ||
    !filename ||
    filename !== path.basename(filename) ||
    !SEGMENT_FILENAME_PATTERN.test(filename)
  ) {
    throw new ApiError(403, "Ruxsat yo'q");
  }

  const resourcePath = `${variant}/seg/${filename}`;
  if (!isAllowedMediaOrigin(req)) throw new ApiError(403, "Ruxsat yo'q (noto'g'ri manba)");
  if (!verifyHlsSignature({ lessonId, resourcePath, exp, uid, sig })) {
    throw new ApiError(403, "Havola muddati o'tgan yoki imzo noto'g'ri");
  }

  const absolutePath = path.join(lessonHlsDir(lessonId), variant, filename);
  if (!fs.existsSync(absolutePath)) throw new ApiError(404, 'Fayl topilmadi');

  res.set('Content-Type', 'video/mp2t');
  res.set('Cache-Control', 'private, max-age=900');
  fs.createReadStream(absolutePath)
    .on('error', () => {
      if (!res.headersSent) res.status(500);
      res.end();
    })
    .pipe(res);
});

// GET /api/v1/media/hls/:lessonId/key — faqat Authorization: Bearer bilan (imzo yo'q),
// har safar jonli kirish huquqi tekshiriladi. authenticate middleware route'da qo'llanadi.
const getKey = asyncHandler(async (req, res) => {
  const { lessonId } = req.params;
  if (!LESSON_ID_PATTERN.test(lessonId)) throw new ApiError(404, 'Dars topilmadi');

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw new ApiError(404, 'Dars topilmadi');

  const course = await Course.findById(lesson.course);
  if (!course) throw new ApiError(404, 'Kurs topilmadi');

  const access = await courseService.hasCourseAccess(course, req.user.id, req.user.role);
  if (!access) throw new ApiError(403, "Sizda bu videoga kirish huquqi yo'q");

  const absolutePath = path.join(lessonHlsDir(lessonId), 'key.bin');
  if (!fs.existsSync(absolutePath)) throw new ApiError(404, 'Kalit topilmadi');

  res.set('Content-Type', 'application/octet-stream');
  res.set('Cache-Control', 'no-store');
  res.send(await fs.promises.readFile(absolutePath));
});

module.exports = { getMasterPlaylist, getVariantPlaylist, getSegment, getKey };
