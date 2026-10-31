const ApiError = require('../utils/ApiError');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Server xatosi';

  // Mongoose: noto'g'ri ID formati
  if (err.name === 'CastError') {
    statusCode = 400;
    message = "Noto'g'ri ID formati";
  }

  // Mongoose: unique field takrorlandi
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `Bu ${field} allaqachon ro'yxatdan o'tgan`;
  }

  // ← qo'shildi
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  }
  // JWT: yaroqsiz token
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Yaroqsiz token';
  }

  // JWT: token muddati tugagan
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token muddati tugagan';
  }

  // Production'da ApiError bo'lmagan kutilmagan (masalan fs/tizim) xatolarning o'z xabari
  // server fayl yo'llarini yoki boshqa ichki tafsilotlarni oshkor qilishi mumkin — shuning
  // uchun bunday hollarda xabar umumiy matn bilan almashtiriladi (stack allaqachon faqat
  // development'da qaytadi)
  if (process.env.NODE_ENV === 'production' && statusCode === 500 && !(err instanceof ApiError)) {
    message = 'Server xatosi';
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    ...(err.code && { code: err.code }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
