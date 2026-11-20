// src/modules/users/userHistory.controller.js
// GET /users/:id/<tarix> — admin/superadmin. Har bir endpoint bir xil shaklda javob beradi:
// data: { <items>: [...], meta } (diamond-history'da qo'shimcha summary ham bor)

const historyService = require('./userHistory.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const QUERY_FIELDS = ['page', 'limit', 'from', 'to', 'type', 'source', 'status'];

const pickQuery = (query) =>
  Object.fromEntries(QUERY_FIELDS.filter((k) => query[k]).map((k) => [k, query[k]]));

const handler = (serviceFn, message) =>
  asyncHandler(async (req, res) => {
    const data = await serviceFn(req.params.id, pickQuery(req.query));
    res.status(200).json(new ApiResponse(200, message, data));
  });

module.exports = {
  getDiamondHistory: handler(historyService.getDiamondHistory, 'Olmos tarixi'),
  getAttempts: handler(historyService.getAttempts, 'Test urinishlari'),
  getEnrollments: handler(historyService.getEnrollments, 'Kurslar'),
  getCertificates: handler(historyService.getCertificates, 'Sertifikatlar'),
  getSpinHistory: handler(historyService.getSpinHistory, 'Kunlik spin tarixi'),
  getActivity: handler(historyService.getActivity, 'Faollik jurnali'),
};
