// src/config/env.js

const requiredEnvVars = ['PORT', 'MONGO_URI', 'JWT_TOKEN_SECRET'];

const validateEnv = () => {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`❌ Muhit o'zgaruvchilari topilmadi: ${missing.join(', ')}`);
    process.exit(1);
  }
};

module.exports = validateEnv;
