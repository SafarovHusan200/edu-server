// src/modules/book-categories/bookCategory.controller.js

const bookCategoryService = require('./bookCategory.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

// POST /api/v1/book-categories
const createBookCategory = asyncHandler(async (req, res) => {
  const { name, description, icon } = req.body;

  const category = await bookCategoryService.createBookCategory({ name, description, icon });

  res.status(201).json(new ApiResponse(201, 'Kitob kategoriyasi yaratildi', { category }));
});

// GET /api/v1/book-categories — public, faqat faol kategoriyalar
const getBookCategories = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;

  const { categories, meta } = await bookCategoryService.getBookCategories({
    page,
    limit,
    onlyActive: true,
  });

  res.status(200).json(new ApiResponse(200, "Kitob kategoriyalari ro'yxati", { categories, meta }));
});

// GET /api/v1/book-categories/:id
const getBookCategoryById = asyncHandler(async (req, res) => {
  const category = await bookCategoryService.getBookCategoryById(req.params.id);

  res.status(200).json(new ApiResponse(200, "Kategoriya ma'lumotlari", { category }));
});

// PATCH /api/v1/book-categories/:id
const updateBookCategory = asyncHandler(async (req, res) => {
  const category = await bookCategoryService.updateBookCategory(req.params.id, req.body);

  res.status(200).json(new ApiResponse(200, 'Kategoriya yangilandi', { category }));
});

// DELETE /api/v1/book-categories/:id
const deleteBookCategory = asyncHandler(async (req, res) => {
  await bookCategoryService.deleteBookCategory(req.params.id);

  res.status(200).json(new ApiResponse(200, "Kategoriya o'chirildi"));
});

module.exports = {
  createBookCategory,
  getBookCategories,
  getBookCategoryById,
  updateBookCategory,
  deleteBookCategory,
};
