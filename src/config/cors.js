// src/config/cors.js
// Qaysi saytlar (origin) brauzerdan API va Socket.IO'ga murojaat qila oladi.
// CLIENT_URL — vergul bilan bir nechta: "https://edu-platform.uz,https://www.edu-platform.uz".
// Production'da majburiy (src/config/env.js tekshiradi) — busiz har qanday sayt
// foydalanuvchi brauzeridan API'ga so'rov yubora olardi. Development/testda berilmasa — '*'.

const parseOrigins = (raw) =>
  String(raw ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);

const getCorsOrigin = () => {
  const origins = parseOrigins(process.env.CLIENT_URL);
  if (origins.length === 0) return '*';
  return origins.length === 1 ? origins[0] : origins;
};

module.exports = { parseOrigins, getCorsOrigin };
