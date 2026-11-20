// src/utils/transaction.js
// MongoDB tranzaksiyalari faqat replica set / sharded klasterda ishlaydi. Standalone
// serverda (masalan lokal dev yoki testlardagi mongodb-memory-server) session.startTransaction
// xato beradi — shuning uchun qo'llab-quvvatlanishi bir marta aniqlanadi va keshlanadi:
// bor bo'lsa fn(session) tranzaksiya ichida, bo'lmasa fn(null) oddiy holda ishlaydi.

const mongoose = require('mongoose');

let supportPromise = null;

const supportsTransactions = () => {
  if (!supportPromise) {
    supportPromise = mongoose.connection.db
      .admin()
      .command({ hello: 1 })
      .then((info) => Boolean(info.setName) || info.msg === 'isdbgrid')
      .catch(() => false);
  }
  return supportPromise;
};

const withTransaction = async (fn) => {
  if (!(await supportsTransactions())) return fn(null);

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};

// Testlar har bir faylda yangi MongoDB instance ko'taradi — keshni tozalash uchun
const resetTransactionSupportCache = () => {
  supportPromise = null;
};

module.exports = { withTransaction, supportsTransactions, resetTransactionSupportCache };
