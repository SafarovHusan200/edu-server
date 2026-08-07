// src/modules/book-categories/bookCategory.service.js

const BookCategory = require('./bookCategory.model');
const Book = require('../books/book.model');
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

  while (await BookCategory.exists({ slug })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
};

const createBookCategory = async ({ name, description, icon }) => {
  const existing = await BookCategory.findOne({ name });
  if (existing) {
    throw new ApiError(400, 'Bu nomdagi kitob kategoriyasi allaqachon mavjud');
  }

  const slug = await buildUniqueSlug(name);

  return BookCategory.create({ name, slug, description, icon });
};

const getBookCategories = async ({ page, limit, onlyActive = true }) => {
  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });
  const filter = onlyActive ? { isActive: true } : {};

  const [categories, total] = await Promise.all([
    BookCategory.find(filter).sort({ name: 1 }).skip(skip).limit(pageLimit),
    BookCategory.countDocuments(filter),
  ]);

  return { categories, meta: buildMeta(total, currentPage, pageLimit) };
};

const getBookCategoryById = async (id) => {
  const category = await BookCategory.findById(id);
  if (!category) throw new ApiError(404, 'Kitob kategoriyasi topilmadi');
  return category;
};

const updateBookCategory = async (id, updateData) => {
  const category = await BookCategory.findById(id);
  if (!category) throw new ApiError(404, 'Kitob kategoriyasi topilmadi');

  if (updateData.name && updateData.name !== category.name) {
    const existing = await BookCategory.findOne({ name: updateData.name });
    if (existing) throw new ApiError(400, 'Bu nomdagi kitob kategoriyasi allaqachon mavjud');
    updateData.slug = await buildUniqueSlug(updateData.name);
  }

  Object.assign(category, updateData);
  await category.save();
  return category;
};

const deleteBookCategory = async (id) => {
  const category = await BookCategory.findById(id);
  if (!category) throw new ApiError(404, 'Kitob kategoriyasi topilmadi');

  const booksUsingCategory = await Book.countDocuments({ category: id });
  if (booksUsingCategory > 0) {
    throw new ApiError(400, "Bu kategoriyada kitoblar mavjud, avval ularni o'chiring yoki ko'chiring");
  }

  await category.deleteOne();
};

module.exports = {
  createBookCategory,
  getBookCategories,
  getBookCategoryById,
  updateBookCategory,
  deleteBookCategory,
};
