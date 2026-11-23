// src/config/env.js

const requiredEnvVars = ['PORT', 'MONGO_URI', 'JWT_TOKEN_SECRET'];

// Ixtiyoriy: yo'q bo'lsa server ishlayveradi, faqat tegishli funksiya o'chiq bo'ladi
const optionalEnvVars = {
  GEMINI_API_KEY: 'AI dars generatsiyasi (POST /board-lessons/generate) 503 qaytaradi',
  GEMINI_MODEL: 'AI dars generatsiyasi (POST /board-lessons/generate) 503 qaytaradi',
};

// Faqat production'da majburiy: CLIENT_URL — CORS ruxsat etilgan saytlar (src/config/cors.js).
// Busiz origin '*' bo'lib qolardi
const requiredInProduction = ['CLIENT_URL'];

const validateEnv = () => {
  const required =
    process.env.NODE_ENV === 'production' ? [...requiredEnvVars, ...requiredInProduction] : requiredEnvVars;
  const missing = required.filter((key) => !process.env[key]?.trim());

  if (missing.length > 0) {
    console.error(`❌ Muhit o'zgaruvchilari topilmadi: ${missing.join(', ')}`);
    process.exit(1);
  }

  Object.entries(optionalEnvVars).forEach(([key, effect]) => {
    if (!process.env[key]) console.warn(`⚠️  ${key} berilmagan — ${effect}`);
  });
};

module.exports = validateEnv;
