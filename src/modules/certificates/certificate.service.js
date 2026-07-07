// src/modules/certificates/certificate.service.js

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');

const Certificate = require('./certificate.model');
const Course = require('../courses/course.model');
const User = require('../users/user.model');
const courseService = require('../courses/course.service');
const notificationService = require('../notifications/notification.service');
const ApiError = require('../../utils/ApiError');
const { getPagination, buildMeta } = require('../../utils/paginate');
const { UPLOADS_ROOT, toPublicPath } = require('../../middleware/upload');

const CERTIFICATES_DIR = path.join(UPLOADS_ROOT, 'certificates');

const generateCertificateNumber = () =>
  `CERT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

// pdfkit bilan oddiy, ramkali sertifikat sahifasi chizib, faylga yozadi
const renderCertificatePdf = ({ studentName, courseTitle, certificateNumber, issuedAt, filePath }) => {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(CERTIFICATES_DIR, { recursive: true });

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 50 });
    const stream = fs.createWriteStream(filePath);

    stream.on('finish', resolve);
    stream.on('error', reject);
    doc.pipe(stream);

    const { width, height } = doc.page;

    doc.rect(30, 30, width - 60, height - 60).lineWidth(2).stroke('#1a3b5d');
    doc.rect(40, 40, width - 80, height - 80).lineWidth(1).stroke('#1a3b5d');

    doc
      .fontSize(34)
      .fillColor('#1a3b5d')
      .text('SERTIFIKAT', 0, 110, { align: 'center' });

    doc
      .fontSize(14)
      .fillColor('#444')
      .text("Ushbu sertifikat quyidagi shaxsga taqdim etiladi:", 0, 175, { align: 'center' });

    doc
      .fontSize(28)
      .fillColor('#000')
      .text(studentName, 0, 205, { align: 'center' });

    doc
      .fontSize(14)
      .fillColor('#444')
      .text('quyidagi kursni muvaffaqiyatli yakunlagani uchun:', 0, 255, { align: 'center' });

    doc
      .fontSize(20)
      .fillColor('#1a3b5d')
      .text(`"${courseTitle}"`, 0, 285, { align: 'center' });

    doc
      .fontSize(11)
      .fillColor('#666')
      .text(`Sana: ${issuedAt.toLocaleDateString('uz-UZ')}`, 0, height - 110, { align: 'center' })
      .text(`Sertifikat raqami: ${certificateNumber}`, 0, height - 90, { align: 'center' })
      .text('edu-platform.uz', 0, height - 70, { align: 'center' });

    doc.end();
  });
};

// Kurs to'liq tugatilganda chaqiriladi — idempotent (bir kursga bitta sertifikat)
const issueCertificate = async (studentId, courseId) => {
  const existing = await Certificate.findOne({ student: studentId, course: courseId });
  if (existing) return existing;

  const [student, course] = await Promise.all([
    User.findById(studentId).select('name'),
    Course.findById(courseId).select('title'),
  ]);

  if (!student || !course) throw new ApiError(404, 'Foydalanuvchi yoki kurs topilmadi');

  const certificateNumber = generateCertificateNumber();
  const issuedAt = new Date();
  const filePath = path.join(CERTIFICATES_DIR, `${certificateNumber}.pdf`);

  await renderCertificatePdf({
    studentName: student.name,
    courseTitle: course.title,
    certificateNumber,
    issuedAt,
    filePath,
  });

  let certificate;
  try {
    certificate = await Certificate.create({
      student: studentId,
      course: courseId,
      certificateNumber,
      pdfPath: toPublicPath(filePath),
      issuedAt,
    });
  } catch (error) {
    // Race condition: shu oraliqda boshqa so'rov allaqachon sertifikat yaratgan bo'lishi mumkin
    if (error.code === 11000) {
      return Certificate.findOne({ student: studentId, course: courseId });
    }
    throw error;
  }

  await notificationService.createNotification({
    userId: studentId,
    type: 'system',
    title: "Tabriklaymiz, sertifikat tayyor!",
    message: `"${course.title}" kursini yakunlaganingiz uchun sertifikat berildi`,
    meta: { courseId: course._id, certificateId: certificate._id },
  });

  return certificate;
};

const getMyCertificates = async (studentId, { page, limit }) => {
  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });
  const filter = { student: studentId };

  const [certificates, total] = await Promise.all([
    Certificate.find(filter)
      .populate('course', 'title thumbnail')
      .sort({ issuedAt: -1 })
      .skip(skip)
      .limit(pageLimit),
    Certificate.countDocuments(filter),
  ]);

  return { certificates, meta: buildMeta(total, currentPage, pageLimit) };
};

const getCertificateForDownload = async (certificateId, userId, role) => {
  const certificate = await Certificate.findById(certificateId).populate('course', 'teacher title');
  if (!certificate) throw new ApiError(404, "Sertifikat topilmadi");

  const isOwner = certificate.student.toString() === userId.toString();
  const isCourseStaff = courseService.isOwnerOrStaff(certificate.course, userId, role);

  if (!isOwner && !isCourseStaff) {
    throw new ApiError(403, "Siz bu sertifikatni yuklab ololmaysiz");
  }

  const absolutePath = path.join(CERTIFICATES_DIR, `${certificate.certificateNumber}.pdf`);
  if (!fs.existsSync(absolutePath)) {
    throw new ApiError(404, 'Sertifikat fayli topilmadi');
  }

  return { absolutePath, filename: `${certificate.certificateNumber}.pdf` };
};

// Public — istalgan kishi (masalan ish beruvchi) sertifikat raqami bo'yicha tekshiradi
const verifyCertificate = async (certificateNumber) => {
  const certificate = await Certificate.findOne({ certificateNumber })
    .populate('student', 'name')
    .populate('course', 'title');

  if (!certificate) {
    return { valid: false };
  }

  return {
    valid: true,
    studentName: certificate.student.name,
    courseTitle: certificate.course.title,
    issuedAt: certificate.issuedAt,
    certificateNumber: certificate.certificateNumber,
  };
};

module.exports = {
  issueCertificate,
  getMyCertificates,
  getCertificateForDownload,
  verifyCertificate,
};
