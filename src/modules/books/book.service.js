// src/modules/books/book.service.js

const fs = require('fs');
const mongoose = require('mongoose');
const path = require('path');
const Book = require('./book.model');
const pick = require('../../utils/pick');
const BookCategory = require('../book-categories/bookCategory.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, buildMeta } = require('../../utils/paginate');
const { UPLOADS_ROOT } = require('../../middleware/upload');

// coverImage/file kabi "/uploads/..." ommaviy yo'lni diskdagi haqiqiy faylga
// o'chirish uchun aylantiradi. Fayl allaqachon yo'q bo'lsa ham xatolik bermaydi.
const deleteUploadedFile = (publicPath) => {
  if (!publicPath) return;

  const absolutePath = path.join(UPLOADS_ROOT, publicPath.replace('/uploads/', ''));
  fs.unlink(absolutePath, (error) => {
    if (error && error.code !== 'ENOENT') {
      console.error("Faylni o'chirishda xato:", error.message);
    }
  });
};

const isOwnerOrStaff = (book, userId, role) => {
  const uploaderId = book.uploadedBy?._id ?? book.uploadedBy;
  const isOwner = uploaderId?.toString() === userId?.toString();
  const isStaff = ['admin', 'superadmin'].includes(role);
  return isOwner || isStaff;
};

const createBook = async ({ title, author, description, category, grade, uploadedBy }) => {
  const categoryDoc = await BookCategory.findById(category);
  if (!categoryDoc) throw new ApiError(400, "Ko'rsatilgan kategoriya topilmadi");

  return Book.create({
    title,
    author,
    description,
    category,
    grade: grade ?? null,
    uploadedBy,
  });
};

// Kim nima ko'radi — kurslardagi bilan bir xil qoida:
// admin/superadmin — hammasi, login qilgan foydalanuvchi — published + o'zi yuklagan draftlar,
// anonim — faqat published
// uploadedBy — muallif bo'yicha filtr ("Kitoblarim" uchun). "me" — joriy foydalanuvchi.
// Ko'rinish qoidasi saqlanadi: boshqa o'qituvchining draftlari baribir chiqmaydi.
const getBooks = async ({ page, limit, category, grade, search, uploadedBy, userId, role }) => {
  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });

  const isStaff = ['admin', 'superadmin'].includes(role);

  const filter = isStaff
    ? {}
    : { $or: [{ isPublished: true }, ...(userId ? [{ uploadedBy: userId }] : [])] };

  if (uploadedBy) {
    const uploaderId = uploadedBy === 'me' ? userId : uploadedBy;
    if (!uploaderId) throw new ApiError(401, "uploadedBy=me uchun avval tizimga kiring");
    if (!mongoose.isValidObjectId(uploaderId)) throw new ApiError(400, "uploadedBy noto'g'ri format");
    filter.uploadedBy = uploaderId;
  }
  if (category) filter.category = category;
  if (grade) filter.grade = grade;
  // search — oddiy matn sifatida izlanadi: regex maxsus belgilari ( . * ( [ va h.k.)
  // ekranlanadi, aks holda "(" kabi qiymat 500 xato berardi
  if (typeof search === 'string' && search.trim()) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$and = [
      ...(filter.$and ?? []),
      { $or: [{ title: { $regex: escaped, $options: 'i' } }, { author: { $regex: escaped, $options: 'i' } }] },
    ];
  }

  const [books, total] = await Promise.all([
    Book.find(filter)
      .populate('category', 'name slug')
      .populate('uploadedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageLimit),
    Book.countDocuments(filter),
  ]);

  return { books, meta: buildMeta(total, currentPage, pageLimit) };
};

const getBookById = async (bookId, userId, role) => {
  const book = await Book.findById(bookId)
    .populate('category', 'name slug')
    .populate('uploadedBy', 'name');

  if (!book) throw new ApiError(404, 'Kitob topilmadi');

  if (!book.isPublished && !isOwnerOrStaff(book, userId, role)) {
    throw new ApiError(404, 'Kitob topilmadi');
  }

  return book;
};

// uploadedBy, file/coverImage (alohida endpointlar), downloadsCount — o'zgartirilmaydi
const BOOK_UPDATABLE_FIELDS = ['title', 'author', 'description', 'category', 'grade', 'isPublished'];

const updateBook = async (bookId, userId, role, updateData) => {
  const book = await Book.findById(bookId);
  if (!book) throw new ApiError(404, 'Kitob topilmadi');

  if (!isOwnerOrStaff(book, userId, role)) {
    throw new ApiError(403, 'Siz bu kitobni tahrirlay olmaysiz');
  }

  Object.assign(book, pick(updateData, BOOK_UPDATABLE_FIELDS));
  await book.save();
  return book;
};

const deleteBook = async (bookId, userId, role) => {
  const book = await Book.findById(bookId);
  if (!book) throw new ApiError(404, 'Kitob topilmadi');

  if (!isOwnerOrStaff(book, userId, role)) {
    throw new ApiError(403, "Siz bu kitobni o'chira olmaysiz");
  }

  deleteUploadedFile(book.coverImage);
  deleteUploadedFile(book.file);

  await book.deleteOne();
};

const setCoverImage = async (bookId, userId, role, publicPath) => {
  const book = await Book.findById(bookId);
  if (!book) throw new ApiError(404, 'Kitob topilmadi');

  if (!isOwnerOrStaff(book, userId, role)) {
    throw new ApiError(403, 'Siz bu kitobni tahrirlay olmaysiz');
  }

  deleteUploadedFile(book.coverImage);
  book.coverImage = publicPath;
  await book.save();
  return book;
};

const setFile = async (bookId, userId, role, publicPath, fileSize) => {
  const book = await Book.findById(bookId);
  if (!book) throw new ApiError(404, 'Kitob topilmadi');

  if (!isOwnerOrStaff(book, userId, role)) {
    throw new ApiError(403, 'Siz bu kitobni tahrirlay olmaysiz');
  }

  deleteUploadedFile(book.file);
  book.file = publicPath;
  book.fileSize = fileSize ?? null;
  await book.save();
  return book;
};

// GET /books/:id/download — faylni beradi va yuklab olishlar sonini oshiradi
const getBookForDownload = async (bookId, userId, role) => {
  const book = await Book.findById(bookId);
  if (!book) throw new ApiError(404, 'Kitob topilmadi');

  if (!book.isPublished && !isOwnerOrStaff(book, userId, role)) {
    throw new ApiError(404, 'Kitob topilmadi');
  }

  if (!book.file) {
    throw new ApiError(404, "Bu kitob uchun fayl hali yuklanmagan");
  }

  book.downloadsCount += 1;
  await book.save();

  return book;
};

module.exports = {
  isOwnerOrStaff,
  createBook,
  getBooks,
  getBookById,
  updateBook,
  deleteBook,
  setCoverImage,
  setFile,
  getBookForDownload,
};
