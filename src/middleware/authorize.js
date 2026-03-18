// src/middleware/authorize.js

const ApiError = require('../utils/ApiError');

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, "Sizda bu amalni bajarish uchun ruxsat yo'q"));
    }
    next();
  };
};

module.exports = authorize;
