// src/modules/spin-questions/spinQuestion.service.js

const SpinQuestion = require('./spinQuestion.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, buildMeta } = require('../../utils/paginate');

const createSpinQuestion = async (createdBy, { grade, question, options, correctIndex, isActive }) => {
  return SpinQuestion.create({
    grade,
    question,
    options,
    correctIndex,
    isActive: isActive ?? true,
    createdBy,
  });
};

// GET /spin-questions?grade= — admin boshqaruv paneli uchun (ixtiyoriy sinf filtri)
const getSpinQuestions = async ({ page, limit, grade }) => {
  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });
  const filter = {};
  if (grade !== undefined) filter.grade = Number(grade);

  const [questions, total] = await Promise.all([
    SpinQuestion.find(filter).sort({ grade: 1, createdAt: -1 }).skip(skip).limit(pageLimit),
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

// daily-spin uchun: berilgan sinf bo'yicha tasodifiy faol savol
const getRandomQuestionForGrade = async (grade) => {
  const [question] = await SpinQuestion.aggregate([
    { $match: { grade, isActive: true } },
    { $sample: { size: 1 } },
  ]);
  return question ? await SpinQuestion.findById(question._id) : null;
};

module.exports = {
  createSpinQuestion,
  getSpinQuestions,
  updateSpinQuestion,
  deleteSpinQuestion,
  getRandomQuestionForGrade,
};
