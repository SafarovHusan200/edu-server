// src/modules/certificates/certificate.routes.js

const express = require('express');
const router = express.Router();

const certificateController = require('./certificate.controller');
const authenticate = require('../../middleware/authenticate');

// GET /api/v1/certificates/verify/:certificateNumber — public
router.get('/verify/:certificateNumber', certificateController.verifyCertificate);

// GET /api/v1/certificates/my
router.get('/my', authenticate, certificateController.getMyCertificates);

// GET /api/v1/certificates/:id/download
router.get('/:id/download', authenticate, certificateController.downloadCertificate);

module.exports = router;
