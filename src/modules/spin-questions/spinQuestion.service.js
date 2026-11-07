// src/modules/spin-questions/spinQuestion.service.js

const SpinQuestion = require('./spinQuestion.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, buildMeta } = require('../../utils/paginate');

const createSpinQuestion = async (createdBy, { category, grade, question, options, correctIndex, isActive }) => {
  return SpinQuestion.create({
    category: category ?? 'knowledge',
    grade,
    question,
    options,
    correctIndex,
    isActive: isActive ?? true,
    createdBy,
  });
};

// GET /spin-questions?grade=&category= — admin boshqaruv paneli uchun (ixtiyoriy filtrlar)
const getSpinQuestions = async ({ page, limit, grade, category }) => {
  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });
  const filter = {};
  if (grade !== undefined) filter.grade = Number(grade);
  if (category !== undefined) filter.category = category;

  const [questions, total] = await Promise.all([
    SpinQuestion.find(filter).sort({ category: 1, grade: 1, createdAt: -1 }).skip(skip).limit(pageLimit),
    SpinQuestion.countDocuments(filter),
  ]);

  return { questions, meta: buildMeta(total, currentPage, pageLimit) };
};

const updateSpinQuestion = async (id, updateData) => {
  const question = await SpinQuestion.findById(id);
  if (!question) throw new ApiError(404, 'Savol topilmadi');

  Object.assign(question, updateData);
  await question.save();
  return question;
};

const deleteSpinQuestion = async (id) => {
  const question = await SpinQuestion.findById(id);
  if (!question) throw new ApiError(404, 'Savol topilmadi');

  await question.deleteOne();
};

// daily-spin uchun: berilgan sinfga mos bilim savoli YOKI (sinfdan qat'i nazar)
// umumiy mantiqiy savollardan tasodifiy biri — ikkalasi bitta to'plam sifatida
// qaraladi, shuning uchun mantiqiy savollar ham, shu sinfga tegishli bilim
// savollari ham teng ehtimollik bilan tushishi mumkin
const getRandomSpinQuestion = async (grade) => {
  const [question] = await SpinQuestion.aggregate([
    {
      $match: {
        isActive: true,
        $or: [{ category: 'knowledge', grade }, { category: 'logic' }],
      },
    },
    { $sample: { size: 1 } },
  ]);
  return question ? await SpinQuestion.findById(question._id) : null;
};

module.exports = {
  createSpinQuestion,
  getSpinQuestions,
  updateSpinQuestion,
  deleteSpinQuestion,
  getRandomSpinQuestion,
};
