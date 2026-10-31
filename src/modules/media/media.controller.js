// src/modules/media/media.controller.js
// Himoyalangan dars video/material fayllarini Range (qisman yuklab olish/oldinga surish)
// qo'llab-quvvatlagan holda beradi. Auth middleware yo'q — himoya so'rov parametrlaridagi
// imzoning o'zida (src/utils/mediaSigning.js).

const fs = require('fs');
const path = require('path');
const { LESSONS_STORAGE_DIR } = require('../../middleware/upload');
const { verifySignature } = require('../../utils/mediaSigning');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');

const MIME_TYPES = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const RANGE_PATTERN = /^bytes=(\d*)-(\d*)$/;

// GET /api/v1/media/lessons/:filename?exp&uid&sig
const getLessonFile = asyncHandler(async (req, res) => {
  const { filename } = req.params;
  const { exp, uid, sig } = req.query;

  // Fayl nomi papka chegarasidan chiqmasligi kerak (path traversal himoyasi)
  if (!filename || filename !== path.basename(filename) || filename.includes('..')) {
    throw new ApiError(403, "Ruxsat yo'q");
  }

  if (!verifySignature({ filename, exp, uid, sig })) {
    throw new ApiError(403, "Havola muddati o'tgan yoki imzo noto'g'ri");
  }

  const absolutePath = path.join(LESSONS_STORAGE_DIR, filename);
  if (!fs.existsSync(absolutePath)) {
    throw new ApiError(404, 'Fayl topilmadi');
  }

  const stat = fs.statSync(absolutePath);
  const contentType = MIME_TYPES[path.extname(filename).toLowerCase()] || 'application/octet-stream';

  res.set('Cache-Control', 'private, max-age=900');
  res.set('Content-Type', contentType);
  res.set('Accept-Ranges', 'bytes');

  const streamAndHandleErrors = (readStream) => {
    readStream.on('error', () => {
      if (!res.headersSent) res.status(500);
      res.end();
    });
    readStream.pipe(res);
  };

  const range = req.headers.range;
  if (!range) {
    res.set('Content-Length', stat.size);
    return streamAndHandleErrors(fs.createReadStream(absolutePath));
  }

  const match = RANGE_PATTERN.exec(range);
  if (!match) {
    res.status(416).set('Content-Range', `bytes */${stat.size}`);
    return res.end();
  }

  let start = match[1] === '' ? undefined : parseInt(match[1], 10);
  let end = match[2] === '' ? undefined : parseInt(match[2], 10);

  if (start === undefined && end === undefined) {
    res.status(416).set('Content-Range', `bytes */${stat.size}`);
    return res.end();
  }

  if (start === undefined) {
    // Suffix-range: "bytes=-500" — faylning oxirgi 500 bayti
    start = Math.max(stat.size - end, 0);
    end = stat.size - 1;
  } else if (end === undefined) {
    end = stat.size - 1;
  }

  if (start >= stat.size || end >= stat.size || start > end) {
    res.status(416).set('Content-Range', `bytes */${stat.size}`);
    return res.end();
  }

  res.status(206);
  res.set('Content-Range', `bytes ${start}-${end}/${stat.size}`);
  res.set('Content-Length', end - start + 1);

  streamAndHandleErrors(fs.createReadStream(absolutePath, { start, end }));
});

module.exports = { getLessonFile };
