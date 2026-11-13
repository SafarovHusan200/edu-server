// src/socket/index.js
// Socket.IO serverini HTTP serverga ulaydi. Hozircha faqat jonli viktorina (/live-quiz) ishlatadi.
// Nginx orqasida bo'lsa /socket.io/ uchun WebSocket upgrade sarlavhalari yoqilishi kerak.

const { Server } = require('socket.io');
const liveQuizSocket = require('../modules/live-quiz/liveQuiz.socket');

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL || '*' },
    // Telefon internet uzilib qolsa ham ulanish darhol tashlab ketilmasin
    pingInterval: 20000,
    pingTimeout: 20000,
  });

  liveQuizSocket.register(io);
  return io;
};

module.exports = { initSocket };
