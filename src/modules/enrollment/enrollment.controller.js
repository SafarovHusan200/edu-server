// src/modules/enrollment/enrollment.controller.js

const enrollmentService = require('./enrollment.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');

// POST /api/v1/enrollment
const enroll = asyncHandler(async (req, res) => {
  const { courseId } = req.body;
  if (!courseId) throw new ApiError(400, 'courseId kiritilishi shart');

  const result = await enrollmentService.enroll(req.user.id, courseId);

  if (result.requiresPayment) {
    return res
      .status(200)
      .json(
        new ApiResponse(200, "Kurs pullik — to'lovni yakunlang", {
          invoiceId: result.invoiceId,
          checkoutUrl: result.checkoutUrl,
        })
      );
  }

  res.status(201).json(new ApiResponse(201, 'Kursga yozildingiz', { enrollment: result.enrollment }));
});

// GET /api/v1/enrollment/my
const getMyEnrollments = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;

  const { enrollments, meta } = await enrollmentService.getMyEnrollments(req.user.id, {
    page,
    limit,
  });

  res.status(200).json(new ApiResponse(200, 'Sizning kurslaringiz', { enrollments, meta }));
});

// GET /api/v1/enrollment/:id
const getEnrollmentById = asyncHandler(async (req, res) => {
  const enrollment = await enrollmentService.getEnrollmentById(
    req.params.id,
    req.user.id,
    req.user.role
  );

  res.status(200).json(new ApiResponse(200, "Enrollment ma'lumotlari", { enrollment }));
});

module.exports = {
  enroll,
  getMyEnrollments,
  getEnrollmentById,
};
