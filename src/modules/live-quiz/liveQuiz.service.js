// src/modules/live-quiz/liveQuiz.service.js

const LiveQuiz = require('./liveQuiz.model');
const LiveSession = require('./liveSession.model');
const Quiz = require('../quizzes/quiz.model');
const Question = require('../questions/question.model');
const { checkQuestionText } = require('./liveQuiz.text');
const gameManager = require('./liveGame.manager');
const ApiError = require('../../utils/ApiError');
const { getPagination, buildMeta } = require('../../utils/paginate');

const STAFF_ROLES = ['admin', 'superadmin'];

// Socket qatlami (liveQuiz.socket.js) ishga tushganda o'rnatiladi. Socket hali ulanmagan
// bo'lsa (masalan testlarda REST'ning o'zi) — hodisalar shunchaki hech qayerga yuborilmaydi.
let emitter = () => {};
const setEmitter = (fn) => {
  emitter = fn;
};

const canManage = (quiz, user) =>
  STAFF_ROLES.includes(user.role) || quiz.createdBy.toString() === user._id.toString();

const findManageable = async (id, user) => {
  const quiz = await LiveQuiz.findById(id);
  if (!quiz) throw new ApiError(404, 'Viktorina topilmadi');
  if (!canManage(quiz, user)) throw new ApiError(403, "Bu viktorina sizga tegishli emas");
  return quiz;
};

// ─────────────── CRUD ───────────────

const createQuiz = async (user, { title, description, questions }) =>
  LiveQuiz.create({ title, description, questions: questions ?? [], createdBy: user._id });

const getMyQuizzes = async (user, { page, limit, search, all }) => {
  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });

  // admin/superadmin all=true bilan hammaning viktorinalarini ko'radi
  const filter = STAFF_ROLES.includes(user.role) && all === 'true' ? {} : { createdBy: user._id };
  const term = typeof search === 'string' ? search.trim() : '';
  if (term) {
    filter.title = { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }

  const [quizzes, total] = await Promise.all([
    LiveQuiz.aggregate([
      { $match: filter },
      { $sort: { updatedAt: -1 } },
      { $skip: skip },
      { $limit: pageLimit },
      {
        $project: {
          title: 1,
          description: 1,
          createdBy: 1,
          createdAt: 1,
          updatedAt: 1,
          questionCount: { $size: '$questions' },
          coverImage: {
            $first: {
              $filter: { input: '$questions.image', as: 'img', cond: { $ne: ['$$img', null] } },
            },
          },
        },
      },
    ]),
    LiveQuiz.countDocuments(filter),
  ]);

  return { quizzes, meta: buildMeta(total, currentPage, pageLimit) };
};

const getQuizById = (id, user) => findManageable(id, user);

const updateQuiz = async (id, user, { title, description, questions }) => {
  const quiz = await findManageable(id, user);
  if (title !== undefined) quiz.title = title;
  if (description !== undefined) quiz.description = description;
  // Savollar to'liq almashtiriladi (frontend muharriri butun ro'yxatni yuboradi)
  if (questions !== undefined) quiz.questions = questions;
  await quiz.save();
  return quiz;
};

// ─────────────── Oddiy testdan (Quiz) import ───────────────

const TRUE_FALSE_OPTIONS = ["To'g'ri", "Noto'g'ri"];

// Bitta test savolini jonli viktorina savoliga aylantiradi. Mos kelmasa — { reason }
const convertQuestion = (q) => {
  const text = typeof q.text === 'string' ? q.text.trim() : '';
  const textError = checkQuestionText(text);
  if (textError) return { reason: textError };

  if (q.type === 'open_ended') {
    return { reason: "Ochiq javobli savol jonli viktorinada ishlatilmaydi" };
  }

  if (q.type === 'true_false') {
    const answer = q.correctAnswer;
    if (answer !== true && answer !== false && answer !== 'true' && answer !== 'false') {
      return { reason: "To'g'ri javob belgilanmagan" };
    }
    const isTrue = answer === true || answer === 'true';
    return { question: { text, options: [...TRUE_FALSE_OPTIONS], correctIndex: isTrue ? 0 : 1 } };
  }

  if (q.type === 'multiple_choice') {
    const options = (q.options ?? []).map((o) => (typeof o?.text === 'string' ? o.text.trim() : ''));
    if (options.length < 2 || options.length > 4) {
      return { reason: `Variantlar soni ${options.length} ta — jonli viktorinada 2-4 ta bo'lishi kerak` };
    }
    if (options.some((o) => !o || o.length > 120)) {
      return { reason: "Variant bo'sh yoki 120 ta belgidan uzun" };
    }
    const correctIndex = Number(q.correctAnswer);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      return { reason: "To'g'ri javob belgilanmagan" };
    }
    return { question: { text, options, correctIndex } };
  }

  return { reason: "Noma'lum savol turi" };
};

// POST /live-quizzes/import/:quizId — mavjud testdan yangi jonli viktorina (NUSXA) yaratadi.
// O'qituvchi faqat o'z testlarini (ulashib qabul qilingan testlar ham — ular o'qituvchining
// mustaqil nusxasi bo'ladi) import qila oladi, admin/superadmin — istalganini.
const importFromQuiz = async (quizId, user, { title } = {}) => {
  const source = await Quiz.findById(quizId);
  if (!source) throw new ApiError(404, 'Test topilmadi');
  if (!STAFF_ROLES.includes(user.role) && source.createdBy.toString() !== user._id.toString()) {
    throw new ApiError(403, "Bu test sizga tegishli emas");
  }

  const sourceQuestions = await Question.find({ quiz: source._id }).sort({ order: 1, createdAt: 1 });

  const questions = [];
  const skipped = [];
  sourceQuestions.forEach((q, index) => {
    const { question, reason } = convertQuestion(q);
    if (question) {
      questions.push({ ...question, timeLimit: 20, pointsMultiplier: 1 });
    } else {
      const preview = String(q.text ?? '').trim();
      skipped.push({ index, text: preview.length > 80 ? `${preview.slice(0, 80)}…` : preview, reason });
    }
  });

  if (questions.length === 0) {
    throw new ApiError(
      400,
      "Bu testda jonli viktorinaga mos savol yo'q (ochiq javobli savollar va 4 tadan ko'p variantli savollar o'tmaydi)",
      'NO_COMPATIBLE_QUESTIONS'
    );
  }

  const liveQuiz = await LiveQuiz.create({
    title: (typeof title === 'string' && title.trim()) || source.title,
    description: source.description ?? '',
    questions,
    createdBy: user._id,
  });

  return { quiz: liveQuiz, imported: questions.length, skipped };
};

const deleteQuiz = async (id, user) => {
  const quiz = await findManageable(id, user);
  await quiz.deleteOne();
};

// ─────────────── Jonli sessiya ───────────────

const startSession = async (id, user) => {
  const quiz = await findManageable(id, user);
  if (quiz.questions.length === 0) {
    throw new ApiError(400, "Viktorinada kamida 1 ta savol bo'lishi kerak");
  }

  const game = gameManager.createGame({
    quiz,
    hostId: user._id,
    emit: (...args) => emitter(...args),
    onFinish: saveSessionResult,
  });

  return {
    pin: game.pin,
    sessionId: game.sessionId,
    quizTitle: game.quizTitle,
    totalQuestions: game.questions.length,
  };
};

// Ishtirokchi sahifasi PIN kiritilganda — o'yin bor-yo'qligini va qo'shilish mumkinligini tekshiradi
const getSessionByPin = (pin) => {
  const game = gameManager.getGame(pin);
  if (!game || game.status === 'finished') throw new ApiError(404, "Bunday PIN bilan o'yin topilmadi");
  return {
    pin: game.pin,
    quizTitle: game.quizTitle,
    status: game.status,
    joinable: game.status === 'lobby' && game.players.size < gameManager.MAX_PLAYERS,
    playerCount: game.players.size,
  };
};

// O'yin tugaganda (liveGame.manager.js → onFinish) chaqiriladi: natijani tarixga saqlaydi
const saveSessionResult = async (game, ranking) => {
  const players = ranking.map((p, i) => ({
    name: p.name,
    user: p.userId,
    score: p.score,
    correctCount: p.correctCount,
    rank: i + 1,
  }));

  const questions = game.questions.map((q, index) => {
    const distribution = q.options.map(() => 0);
    let correctCount = 0;
    for (const p of ranking) {
      const a = p.answers.get(index);
      if (a) {
        distribution[a.option] += 1;
        if (a.correct) correctCount += 1;
      }
    }
    return {
      text: q.text,
      image: q.image,
      options: q.options,
      correctIndex: q.correctIndex,
      distribution,
      answeredCount: distribution.reduce((s, n) => s + n, 0),
      correctCount,
    };
  });

  return LiveSession.create({
    quiz: game.quizId,
    host: game.hostId,
    pin: game.pin,
    quizTitle: game.quizTitle,
    startedAt: game.startedAt,
    endedAt: game.endedAt,
    players,
    questions,
  });
};

const getQuizResults = async (id, user, { page, limit }) => {
  const quiz = await findManageable(id, user);
  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });
  const filter = { quiz: quiz._id };

  const [sessions, total] = await Promise.all([
    LiveSession.find(filter)
      .select('pin quizTitle startedAt endedAt players createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageLimit)
      .lean(),
    LiveSession.countDocuments(filter),
  ]);

  // Ro'yxat uchun qisqa ko'rinish: ishtirokchilar soni va g'oliblar
  const items = sessions.map((s) => ({
    _id: s._id,
    pin: s.pin,
    quizTitle: s.quizTitle,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    playerCount: s.players.length,
    podium: s.players.slice(0, 3),
  }));

  return { sessions: items, meta: buildMeta(total, currentPage, pageLimit) };
};

const getSessionResult = async (sessionId, user) => {
  const session = await LiveSession.findById(sessionId);
  if (!session) throw new ApiError(404, 'Natija topilmadi');
  if (!STAFF_ROLES.includes(user.role) && session.host.toString() !== user._id.toString()) {
    throw new ApiError(403, "Bu natija sizga tegishli emas");
  }
  return session;
};

module.exports = {
  setEmitter,
  createQuiz,
  getMyQuizzes,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  importFromQuiz,
  startSession,
  getSessionByPin,
  saveSessionResult,
  getQuizResults,
  getSessionResult,
};
