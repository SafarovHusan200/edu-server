// src/modules/certificates/certificate.controller.js

const certificateService = require('./certificate.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

// GET /api/v1/certificates/my
const getMyCertificates = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;

  const { certificates, meta } = await certificateService.getMyCertificates(req.user.id, {
    page,
    limit,
  });

  res.status(200).json(new ApiResponse(200, "Sertifikatlaringiz", { certificates, meta }));
});

// GET /api/v1/certificates/:id/download
const downloadCertificate = asyncHandler(async (req, res) => {
  const { absolutePath, filename } = await certificateService.getCertificateForDownload(
    req.params.id,
    req.user.id,
    req.user.role
  );

  res.download(absolutePath, filename);
});

// GET /api/v1/certificates/verify/:certificateNumber — public
const verifyCertificate = asyncHandler(async (req, res) => {
  const result = await certificateService.verifyCertificate(req.params.certificateNumber);

  res.status(200).json(new ApiResponse(200, result.valid ? "Sertifikat haqiqiy" : "Sertifikat topilmadi", result));
});

module.exports = {
  getMyCertificates,
  downloadCertificate,
  verifyCertificate,
};
