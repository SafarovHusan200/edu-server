// src/middleware/upload.js

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const ApiError = require('../utils/ApiError');

const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');

// Dars video/materiallari endi ochiq /uploads orqali emas, imzolangan GET /media/lessons/:file
// orqali beriladi (src/utils/mediaSigning.js) — shuning uchun bu fayllar public static
// papkadan tashqarida, alohida ildizda saqlanadi
const STORAGE_ROOT = path.join(__dirname, '..', '..', 'storage');
const LESSONS_STORAGE_DIR = path.join(STORAGE_ROOT, 'lessons');

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MATERIAL_MIME_TYPES = [...IMAGE_MIME_TYPES, 'application/pdf', 'video/mp4'];
const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

const buildStorage = (subdir, root = UPLOADS_ROOT) => {
  const dest = path.join(root, subdir);

  return multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const uniqueName = `${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, uniqueName);
    },
  });
};

const buildFileFilter = (allowedMimeTypes) => (req, file, cb) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new ApiError(400, `Ruxsat etilmagan fayl turi: ${file.mimetype}`));
  }
  cb(null, true);
};

// Rasm (avatar, kurs muqovasi) — 5MB gacha
const uploadImage = (subdir) =>
  multer({
    storage: buildStorage(subdir),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: buildFileFilter(IMAGE_MIME_TYPES),
  });

// Dars materiali (rasm/pdf/video) — 20MB gacha. Himoyalangan STORAGE_ROOT'ga yoziladi
// (public emas) — faqat kirish huquqi bor foydalanuvchiga imzolangan havola orqali beriladi
const uploadMaterial = (subdir) =>
  multer({
    storage: buildStorage(subdir, STORAGE_ROOT),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: buildFileFilter(MATERIAL_MIME_TYPES),
  });

// Darsning asosiy videosi (lesson.videoUrl) — material (qo'shimcha fayl)dan farqli,
// haqiqiy video darslar odatda 20MB'dan ancha katta bo'lgani uchun limit kattaroq.
// Shuningdek himoyalangan STORAGE_ROOT'ga yoziladi.
const uploadVideo = (subdir) =>
  multer({
    storage: buildStorage(subdir, STORAGE_ROOT),
    limits: { fileSize: 300 * 1024 * 1024 },
    fileFilter: buildFileFilter(VIDEO_MIME_TYPES),
  });

// req.file.path (diskdagi to'liq yo'l) ni /uploads/... ommaviy URL'ga aylantiradi
// (faqat uploadImage uchun — ochiq static papka)
const toPublicPath = (absolutePath) => {
  const relative = path.relative(UPLOADS_ROOT, absolutePath).split(path.sep).join('/');
  return `/uploads/${relative}`;
};

// Himoyalangan dars fayli uchun: DB'da saqlanadigan "mantiqiy" yo'l eski formatdagi
// (/uploads/lessons/<fayl>) ko'rinishida qoladi — faqat fayl nomi muhim, haqiqiy fayl esa
// STORAGE_ROOT/lessons'da yotadi. src/utils/mediaSigning.js shu prefiksni tanib,
// javobga chiqishdan oldin imzolangan havolaga aylantiradi.
const toProtectedPath = (absolutePath) => `/uploads/lessons/${path.basename(absolutePath)}`;

module.exports = {
  uploadImage,
  uploadMaterial,
  uploadVideo,
  toPublicPath,
  toProtectedPath,
  UPLOADS_ROOT,
  STORAGE_ROOT,
  LESSONS_STORAGE_DIR,
};
