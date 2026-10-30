// src/utils/ApiError.js

class ApiError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.statusCode = statusCode;
    // Ixtiyoriy mashina o'qiy oladigan xato kodi (masalan "ATTEMPT_EXPIRED") —
    // frontend matnni qidirish o'rniga shu kodga qarab aniq holatni ushlab olishi uchun
    this.code = code;
  }
}

module.exports = ApiError;
