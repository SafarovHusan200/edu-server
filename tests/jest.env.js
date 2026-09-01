// tests/jest.env.js — testlar boshlanishidan oldin muhit o'zgaruvchilarini o'rnatadi

process.env.NODE_ENV = 'test';
process.env.JWT_TOKEN_SECRET = 'test_jwt_secret';
process.env.JWT_EXPIRE = '1d';
process.env.PAGE_LIMIT = '10';

process.env.MULTICARD_APP_ID = 'test_app_id';
process.env.MULTICARD_SECRET = 'test_secret';
process.env.MULTICARD_STORE_ID = 'test_store_id';
process.env.MULTICARD_BASE_URL = 'https://dev-mesh.multicard.uz';
process.env.MULTICARD_CALLBACK_URL = 'http://localhost:5000/api/v1/payment/callback';

// Testlarda oldindan bilingan, aniq son bo'lishi uchun (30 kunlik reja = 5 000 000 tiyin,
// qolganlari shundan avtomatik hisoblanadi — src/config/pricing.js'ga qarang)
process.env.PREMIUM_PRICE_30D = '5000000';
