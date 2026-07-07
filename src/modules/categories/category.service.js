// src/modules/categories/category.service.js

const Category = require('./category.model');
const Course = require('../courses/course.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, buildMeta } = require('../../utils/paginate');

const slugify = (text) =>
  text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const buildUniqueSlug = async (name) => {
  const base = slugify(name);
  let slug = base;
  let suffix = 1;

  while (await Category.exists({ slug })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
};

const createCategory = async ({ name, description, icon }) => {
  const existing = await Category.findOne({ name });
  if (existing) {
    throw new ApiError(400, "Bu nomdagi kategoriya allaqachon mavjud");
  }

  const slug = await buildUniqueSlug(name);

  return Category.create({ name, slug, description, icon });
};

const getCategories = async ({ page, limit, onlyActive = true }) => {
  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });
  const filter = onlyActive ? { isActive: true } : {};

  const [categories, total] = await Promise.all([
    Category.find(filter).sort({ name: 1 }).skip(skip).limit(pageLimit),
    Category.countDocuments(filter),
  ]);

  return { categories, meta: buildMeta(total, currentPage, pageLimit) };
};

const getCategoryById = async (id) => {
  const category = await Category.findById(id);
  if (!category) throw new ApiError(404, 'Kategoriya topilmadi');
  return category;
};

const updateCategory = async (id, updateData) => {
  const category = await Category.findById(id);
  if (!category) throw new ApiError(404, 'Kategoriya topilmadi');

  if (updateData.name && updateData.name !== category.name) {
    const existing = await Category.findOne({ name: updateData.name });
    if (existing) throw new ApiError(400, "Bu nomdagi kategoriya allaqachon mavjud");
    updateData.slug = await buildUniqueSlug(updateData.name);
  }

  Object.assign(category, updateData);
  await category.save();
  return category;
};

const deleteCategory = async (id) => {
  const category = await Category.findById(id);
  if (!category) throw new ApiError(404, 'Kategoriya topilmadi');

  const coursesUsingCategory = await Course.countDocuments({ category: id });
  if (coursesUsingCategory > 0) {
    throw new ApiError(400, "Bu kategoriyada kurslar mavjud, avval ularni o'chiring yoki ko'chiring");
  }

  await category.deleteOne();
};

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
