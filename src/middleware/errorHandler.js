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

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
