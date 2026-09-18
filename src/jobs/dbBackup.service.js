// src/jobs/dbBackup.service.js
// Bazadagi BARCHA kolleksiyalarni bitta gzip'langan JSON faylga eksport qiladi —
// MongoDB Atlas ishdan chiqsa yoki ma'lumot yo'qolsa, shu fayl orqali qo'lda
// tiklash mumkin (scripts/restoreBackup.js). Mongoose'da ro'yxatdan o'tgan barcha
// modellar avtomatik qamrab olinadi — yangi modul qo'shilsa alohida ro'yxatga
// kiritish shart emas.

const mongoose = require('mongoose');
const zlib = require('zlib');

// Ba'zi kolleksiyalarda eksport qilinmasligi kerak bo'lgan nozik maydonlar —
// Telegram orqali yuborilganda tashqariga chiqib ketmasligi uchun. Parol hash
// bo'lsa ham, xavfsizlik amaliyoti sifatida baribir chiqarib tashlanadi; tiklashda
// bu foydalanuvchilar parolsiz qoladi (faqat Telegram orqali kirishlari mumkin
// bo'ladi, tiklangandan keyin "parolni unutdim" orqali qayta o'rnatishlari kerak).
const REDACT_FIELDS = {
  users: ['password'],
  otps: ['code'],
};

// Barcha ro'yxatdan o'tgan Mongoose modellarini kolleksiya nomi bo'yicha xaritalaydi
const getAllModels = () =>
  mongoose.modelNames().map((name) => mongoose.model(name));

const createBackupBuffer = async () => {
  const models = getAllModels();
  const collections = {};

  for (const Model of models) {
    const collectionKey = Model.collection.collectionName;
    const redact = REDACT_FIELDS[collectionKey] || [];

    const docs = await Model.find({}).lean();

    collections[collectionKey] = redact.length
      ? docs.map((doc) => {
          const clone = { ...doc };
          redact.forEach((field) => delete clone[field]);
          return clone;
        })
      : docs;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    collections,
  };

  const json = JSON.stringify(payload);
  const buffer = zlib.gzipSync(json);

  return {
    buffer,
    sizeBytes: buffer.length,
    collectionCount: Object.keys(collections).length,
    documentCount: Object.values(collections).reduce((sum, docs) => sum + docs.length, 0),
  };
};

module.exports = { createBackupBuffer };
