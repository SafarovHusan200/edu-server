// src/modules/spin-questions/spinQuestion.controller.js

const spinQuestionService = require('./spinQuestion.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

// POST /api/v1/spin-questions
const createSpinQuestion = asyncHandler(async (req, res) => {
  const { category, grade, question, options, correctIndex, isActive } = req.body;

  const spinQuestion = await spinQuestionService.createSpinQuestion(req.user.id, {
    category,
    grade,
    question,
    options,
    correctIndex,
    isActive,
  });

  res.status(201).json(new ApiResponse(201, 'Savol qo\'shildi', { question: spinQuestion }));
});

// GET /api/v1/spin-questions?page=&limit=&grade=&category=
const getSpinQuestions = asyncHandler(async (req, res) => {
  const { page, limit, grade, category } = req.query;

  const { questions, meta } = await spinQuestionService.getSpinQuestions({ page, limit, grade, category });

  res.status(200).json(new ApiResponse(200, "Savollar ro'yxati", { questions, meta }));
});

// PATCH /api/v1/spin-questions/:id
const updateSpinQuestion = asyncHandler(async (req, res) => {
  const question = await spinQuestionService.updateSpinQuestion(req.params.id, req.body);

  res.status(200).json(new ApiResponse(200, 'Savol yangilandi', { question }));
});

// DELETE /api/v1/spin-questions/:id
const deleteSpinQuestion = asyncHandler(async (req, res) => {
  await spinQuestionService.deleteSpinQuestion(req.params.id);

  res.status(200).json(new ApiResponse(200, "Savol o'chirildi"));
});

module.exports = { createSpinQuestion, getSpinQuestions, updateSpinQuestion, deleteSpinQuestion };
