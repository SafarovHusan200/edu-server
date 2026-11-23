// src/app.js

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const swaggerSpec = require('./config/swagger');
const routes = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();

// ETag/304 kerak emas — API javoblari foydalanuvchiga xos va tez-tez o'zgaradi,
// keshlash foyda bermaydi, aksincha ba'zi HTTP client'larda bo'sh javobga olib
// kelishi mumkin (304 body'siz keladi). /uploads statik fayllar keshlashiga
// bu ta'sir qilmaydi — u express.static'ning o'z alohida etag mexanizmi.
app.set('etag', false);

// Server nginx (reverse proxy) ortida ishlaydi. Busiz req.ip har doim proksining IP'si
// bo'ladi: rate limiter BARCHA foydalanuvchilarni bitta mijoz deb sanaydi (butun sayt uchun
// bitta 300 so'rov / 10 login chegarasi), faollik jurnaliga ham proksi IP'si yoziladi.
// Standart 'loopback' — faqat shu mashinadagi (127.0.0.1/::1) proksining X-Forwarded-For
// sarlavhasiga ishoniladi, tashqaridan kelgan soxta sarlavha e'tiborga olinmaydi.
// Proksi boshqa mashinada yoki oldida Cloudflare bo'lsa — TRUST_PROXY'da sozlanadi
// (hop soni, masalan 2, yoki IP/subnet ro'yxati): https://expressjs.com/en/guide/behind-proxies.html
const parseTrustProxy = (raw) => {
  if (raw === undefined || raw === '') return 'loopback';
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw;
};
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));

// ─────────────────────────────────────────
// Global Middleware
// ─────────────────────────────────────────
// crossOriginResourcePolicy: default helmet "same-origin" bo'lganida frontend
// (boshqa origin) /uploads dagi rasmlarni <img> orqali ko'rsata olmaydi —
// bu API alohida frontend origin tomonidan iste'mol qilinishi uchun ochiladi.
// /api-docs ga helmet'ning standart Content-Security-Policy'si qo'llanmaydi —
// aks holda swagger-ui-express o'zining inline script/style'lari brauzerda
// bloklanib, sahifa ishlamay qoladi. Qolgan barcha route'lar odatdagidek himoyalangan.
app.use((req, res, next) => {
  if (req.path.startsWith('/api-docs')) return next();
  helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })(req, res, next);
});
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json()); // JSON body parser
app.use(express.urlencoded({ extended: true }));

// So'rov gavdasi (Content-Type: application/json) umuman yuborilmasa, Express 5'da
// req.body {} emas, undefined bo'lib qoladi — bu esa "const { x } = req.body" kabi
// destructuring qiluvchi controllerlarni (masalan ixtiyoriy maydonlar bilan) 500
// xato bilan qulatib qo'yishi mumkin. Shu yerda global qilib to'g'irlab qo'yamiz.
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev')); // Request logger
}

// Dars video/materiallari (lessons) endi ochiq statik papkadan berilmaydi — eski
// /uploads/lessons/<fayl> havolasi endi tokensiz yuklab olinmasligi uchun yopiladi.
// Bunday fayllar GET /media/lessons/:file orqali, faqat imzolangan havola bilan beriladi
// (src/utils/mediaSigning.js). Kurs muqovalari, avatarlar va h.k. ochiq qolaveradi.
app.use('/uploads/lessons', (req, res) => res.status(404).json({ success: false, statusCode: 404, message: 'Topilmadi' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ─────────────────────────────────────────
// API hujjatlari (Swagger)
// ─────────────────────────────────────────
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: 'Edu Platform API' }));

// ─────────────────────────────────────────
// Routes
// ─────────────────────────────────────────
app.use('/api/v1', apiLimiter, routes);

// ─────────────────────────────────────────
// Health check
// ─────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server ishlayapti ✅',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────
// Error handlers (eng oxirida bo'lishi shart)
// ─────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
