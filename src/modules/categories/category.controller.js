// src/modules/categories/category.controller.js

const categoryService = require('./category.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

// POST /api/v1/categories
const createCategory = asyncHandler(async (req, res) => {
  const { name, description, icon } = req.body;

  const category = await categoryService.createCategory({ name, description, icon });

  res.status(201).json(new ApiResponse(201, 'Kategoriya yaratildi', { category }));
});

// GET /api/v1/categories — public, faqat faol kategoriyalar
const getCategories = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;

  const { categories, meta } = await categoryService.getCategories({
    page,
    limit,
    onlyActive: true,
  });

  res.status(200).json(new ApiResponse(200, "Kategoriyalar ro'yxati", { categories, meta }));
});

// GET /api/v1/categories/:id
const getCategoryById = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryById(req.params.id);

  res.status(200).json(new ApiResponse(200, "Kategoriya ma'lumotlari", { category }));
});

// PATCH /api/v1/categories/:id
const updateCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(req.params.id, req.body);

  res.status(200).json(new ApiResponse(200, 'Kategoriya yangilandi', { category }));
});

// DELETE /api/v1/categories/:id
const deleteCategory = asyncHandler(async (req, res) => {
  await categoryService.deleteCategory(req.params.id);

  res.status(200).json(new ApiResponse(200, "Kategoriya o'chirildi"));
});

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
