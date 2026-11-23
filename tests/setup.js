// tests/setup.js — har bir test fayli uchun xotiradagi MongoDB instance ko'taradi

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  // MongoDB drayveri (7.6+) handshake metadatasi uchun `os`ni `await import('os')` bilan
  // yuklaydi. Jest (ESM'siz) VM'ida dinamik import ishlamaydi — metadata bo'sh ketib, server
  // "Missing required sub-document 'driver'" deb ulanishni rad etadi va har bir test faylining
  // beforeAll'i 30s'da timeout bo'ladi. Shuning uchun os modulini to'g'ridan-to'g'ri beramiz.
  // Faqat test muhitiga tegishli — production'da Node dinamik importni bemalol bajaradi.
  await mongoose.connect(mongod.getUri(), { runtimeAdapters: { os: require('os') } });
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});
