// src/modules/books/book.controller.js

const path = require('path');
const bookService = require('./book.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const { toPublicPath, UPLOADS_ROOT } = require('../../middleware/upload');

// POST /api/v1/books
const createBook = asyncHandler(async (req, res) => {
  const { title, author, description, category, grade } = req.body;

  const book = await bookService.createBook({
    title,
    author,
    description,
    category,
    grade,
    uploadedBy: req.user.id,
  });

  res.status(201).json(new ApiResponse(201, 'Kitob yaratildi', { book }));
});

// GET /api/v1/books
const getBooks = asyncHandler(async (req, res) => {
  const { page, limit, category, grade, search } = req.query;

  const { books, meta } = await bookService.getBooks({
    page,
    limit,
    category,
    grade,
    search,
    userId: req.user?.id,
    role: req.user?.role,
  });

  res.status(200).json(new ApiResponse(200, "Kitoblar ro'yxati", { books, meta }));
});

// GET /api/v1/books/:id
const getBookById = asyncHandler(async (req, res) => {
  const book = await bookService.getBookById(req.params.id, req.user?.id, req.user?.role);

  res.status(200).json(new ApiResponse(200, "Kitob ma'lumotlari", { book }));
});

// PATCH /api/v1/books/:id
const updateBook = asyncHandler(async (req, res) => {
  const book = await bookService.updateBook(req.params.id, req.user.id, req.user.role, req.body);

  res.status(200).json(new ApiResponse(200, 'Kitob yangilandi', { book }));
});

// DELETE /api/v1/books/:id
const deleteBook = asyncHandler(async (req, res) => {
  await bookService.deleteBook(req.params.id, req.user.id, req.user.role);

  res.status(200).json(new ApiResponse(200, "Kitob o'chirildi"));
});

// POST /api/v1/books/:id/cover
const uploadCover = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Rasm fayli yuborilishi shart');

  const book = await bookService.setCoverImage(
    req.params.id,
    req.user.id,
    req.user.role,
    toPublicPath(req.file.path)
  );

  res.status(200).json(new ApiResponse(200, 'Muqova yuklandi', { book }));
});

// POST /api/v1/books/:id/file
const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Kitob fayli yuborilishi shart');

  const book = await bookService.setFile(
    req.params.id,
    req.user.id,
    req.user.role,
    toPublicPath(req.file.path)
  );

  res.status(200).json(new ApiResponse(200, 'Kitob fayli yuklandi', { book }));
});

// GET /api/v1/books/:id/download
const downloadBook = asyncHandler(async (req, res) => {
  const book = await bookService.getBookForDownload(req.params.id, req.user?.id, req.user?.role);

  const absolutePath = path.join(UPLOADS_ROOT, book.file.replace('/uploads/', ''));
  const filename = `${book.title}${path.extname(absolutePath)}`;

  res.download(absolutePath, filename);
});

module.exports = {
  createBook,
  getBooks,
  getBookById,
  updateBook,
  deleteBook,
  uploadCover,
  uploadFile,
  downloadBook,
};
