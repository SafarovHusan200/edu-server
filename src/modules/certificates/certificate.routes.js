// src/modules/certificates/certificate.routes.js

const express = require('express');
const router = express.Router();

const certificateController = require('./certificate.controller');
const authenticate = require('../../middleware/authenticate');

/**
 * @swagger
 * /certificates/verify/{certificateNumber}:
 *   get:
 *     summary: Sertifikat raqami orqali haqiqiyligini tekshirish
 *     tags: [Certificates]
 *     security: []
 *     parameters:
 *       - { name: certificateNumber, in: path, required: true, schema: { type: string }, example: 'CERT-654F1C2E8B1D' }
 *     responses:
 *       200:
 *         description: Sertifikat topildi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Certificate' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// GET /api/v1/certificates/verify/:certificateNumber — public
router.get('/verify/:certificateNumber', certificateController.verifyCertificate);

/**
 * @swagger
 * /certificates/my:
 *   get:
 *     summary: O'zining sertifikatlarini olish
 *     tags: [Certificates]
 *     responses:
 *       200:
 *         description: Sertifikatlar ro'yxati
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Certificate' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// GET /api/v1/certificates/my
router.get('/my', authenticate, certificateController.getMyCertificates);

/**
 * @swagger
 * /certificates/{id}/download:
 *   get:
 *     summary: Sertifikat PDF faylini yuklab olish
 *     tags: [Certificates]
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       200:
 *         description: Fayl (PDF)
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// GET /api/v1/certificates/:id/download
router.get('/:id/download', authenticate, certificateController.downloadCertificate);

module.exports = router;
