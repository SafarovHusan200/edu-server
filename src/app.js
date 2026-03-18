// src/app.js

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const routes = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ─────────────────────────────────────────
// Global Middleware
// ─────────────────────────────────────────
app.use(helmet()); // HTTP header himoyasi
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json()); // JSON body parser
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev')); // Request logger
}

// ─────────────────────────────────────────
// Routes
// ─────────────────────────────────────────
app.use('/api/v1', routes);

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
