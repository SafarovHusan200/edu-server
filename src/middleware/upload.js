// src/middleware/upload.js

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const ApiError = require('../utils/ApiError');

const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MATERIAL_MIME_TYPES = [...IMAGE_MIME_TYPES, 'application/pdf', 'video/mp4'];

const buildStorage = (subdir) => {
  const dest = path.join(UPLOADS_ROOT, subdir);

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

// Dars materiali (rasm/pdf/video) — 20MB gacha
const uploadMaterial = (subdir) =>
  multer({
    storage: buildStorage(subdir),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: buildFileFilter(MATERIAL_MIME_TYPES),
  });

// req.file.path (diskdagi to'liq yo'l) ni /uploads/... ommaviy URL'ga aylantiradi
const toPublicPath = (absolutePath) => {
  const relative = path.relative(UPLOADS_ROOT, absolutePath).split(path.sep).join('/');
  return `/uploads/${relative}`;
};

module.exports = { uploadImage, uploadMaterial, toPublicPath, UPLOADS_ROOT };
