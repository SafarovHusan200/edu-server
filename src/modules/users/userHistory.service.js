// src/modules/users/userHistory.service.js
// Admin: /admin/users/:id sahifasidagi tablar uchun bitta foydalanuvchining tarixi.
// Hamma ro'yxatlar bir xil qoidada: page/limit (default 20), from/to (createdAt bo'yicha),
// eng yangisi birinchi, meta.total filtrlangan natija bo'yicha. Student bo'lmagan
// foydalanuvchida bu yozuvlar bo'lmaydi — natija shunchaki bo'sh ro'yxat.

const mongoose = require('mongoose');
const User = require('./user.model');
const DiamondTransaction = require('../diamond-ledger/diamondTransaction.model');
const QuizAttempt = require('../quiz-attempts/quizAttempt.model');
const Enrollment = require('../enrollment/enrollment.model');
const Certificate = require('../certificates/certificate.model');
const DailySpin = require('../daily-spin/dailySpin.model');
const UserActivity = require('../user-activity/userActivity.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, buildMeta } = require('../../utils/paginate');
const { countLessonsByCourse } = require('../../utils/lessonsCount');

const HISTORY_DEFAULT_LIMIT = 20;
const ACTOR_FIELDS = 'name role';

const round2 = (n) => Math.round((n ?? 0) * 100) / 100;

const ensureUser = async (userId) => {
  const user = await User.findById(userId).select('role diamonds');
  if (!user) throw new ApiError(404, 'Foydalanuvchi topilmadi');
  return user;
};

// Umumiy filtr va sahifalash: { userField: id } + createdAt oralig'i
const buildQuery = (userField, userId, { page, limit, from, to }) => {
  const filter = { [userField]: new mongoose.Types.ObjectId(String(userId)) };
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  const pagination = getPagination({ page, limit: limit || HISTORY_DEFAULT_LIMIT });
  return { filter, ...pagination };
};

const runPaged = async (Model, filter, { skip, limit }, { sort, select, populate }) => {
  let q = Model.find(filter).sort(sort).skip(skip).limit(limit).lean();
  if (select) q = q.select(select);
  for (const p of populate ?? []) q = q.populate(p);
  return Promise.all([q, Model.countDocuments(filter)]);
};

const titleRef = (doc, field = 'title') => (doc ? { _id: doc._id, title: doc[field] ?? null } : null);
const actorView = (actor) => (actor ? { _id: actor._id, name: actor.name, role: actor.role } : null);

// ─────────────────────────────────────────
// 1. GET /users/:id/diamond-history
// ─────────────────────────────────────────
const getDiamondHistory = async (userId, query) => {
  const user = await ensureUser(userId);
  const { filter, page, limit, skip } = buildQuery('user', userId, query);
  if (query.type) filter.type = query.type;
  if (query.source) filter.source = query.source;

  // summary — filtrdan qat'i nazar butun tarix bo'yicha
  const [[items, total], totals] = await Promise.all([
    runPaged(DiamondTransaction, filter, { skip, limit }, {
      sort: { createdAt: -1, _id: -1 },
      populate: [{ path: 'actor', select: ACTOR_FIELDS }],
    }),
    DiamondTransaction.aggregate([
      { $match: { user: filter.user } },
      { $group: { _id: '$type', sum: { $sum: '$amount' } } },
    ]),
  ]);

  const sumOf = (type) => round2(totals.find((t) => t._id === type)?.sum);

  return {
    history: items.map((e) => ({
      _id: e._id,
      amount: e.amount,
      type: e.type,
      source: e.source,
      ref: e.ref ? { kind: e.ref.kind, _id: e.ref.id, title: e.ref.title ?? null } : null,
      balanceAfter: e.balanceAfter,
      note: e.note ?? null,
      actor: actorView(e.actor),
      createdAt: e.createdAt,
    })),
    summary: { totalEarned: sumOf('earn'), totalSpent: sumOf('spend'), balance: user.diamonds },
    meta: buildMeta(total, page, limit),
  };
};

// ─────────────────────────────────────────
// 2. GET /users/:id/attempts — javoblarsiz (tafsilot: GET /quizzes/attempts/:attemptId)
// ─────────────────────────────────────────
const getAttempts = async (userId, query) => {
  await ensureUser(userId);
  const { filter, page, limit, skip } = buildQuery('student', userId, query);
  if (query.status) filter.status = query.status;

  const [items, total] = await runPaged(QuizAttempt, filter, { skip, limit }, {
    sort: { startedAt: -1, _id: -1 },
    select: '-answers',
    populate: [{ path: 'quiz', select: 'title' }],
  });

  return {
    attempts: items.map((a) => ({
      _id: a._id,
      quiz: titleRef(a.quiz),
      attemptNumber: a.attemptNumber,
      status: a.status,
      scorePercent: a.scorePercent,
      earnedPoints: a.earnedPoints,
      totalPoints: a.totalPoints,
      passed: a.passed,
      diamondsEarned: a.diamondsEarned ?? null,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt ?? null,
      // lean() virtual'larni bermaydi — model'dagi durationSeconds bilan bir xil formula
      durationSeconds:
        a.submittedAt && a.startedAt
          ? Math.round((new Date(a.submittedAt) - new Date(a.startedAt)) / 1000)
          : null,
    })),
    meta: buildMeta(total, page, limit),
  };
};

// ─────────────────────────────────────────
// 3. GET /users/:id/enrollments
// ─────────────────────────────────────────
const getEnrollments = async (userId, query) => {
  await ensureUser(userId);
  const { filter, page, limit, skip } = buildQuery('student', userId, query);
  if (query.status) filter.status = query.status;

  const [items, total] = await runPaged(Enrollment, filter, { skip, limit }, {
    sort: { createdAt: -1, _id: -1 },
    populate: [{ path: 'course', select: 'title' }],
  });

  const lessonCounts = await countLessonsByCourse(
    items.map((e) => e.course?._id).filter(Boolean)
  );

  return {
    enrollments: items.map((e) => {
      const completedAt =
        e.status === 'completed' && e.completedLessons?.length
          ? e.completedLessons.reduce(
              (max, l) => (l.completedAt && l.completedAt > max ? l.completedAt : max),
              e.completedLessons[0].completedAt ?? null
            )
          : null;

      return {
        _id: e._id,
        course: titleRef(e.course),
        progress: e.progress ?? 0,
        completedLessonsCount: e.completedLessons?.length ?? 0,
        totalLessons: e.course ? lessonCounts.get(e.course._id.toString()) ?? 0 : 0,
        status: e.status,
        createdAt: e.createdAt,
        // Alohida saqlanmaydi — kurs tugagan bo'lsa oxirgi tugatilgan dars vaqti
        completedAt,
      };
    }),
    meta: buildMeta(total, page, limit),
  };
};

// ─────────────────────────────────────────
// 4. GET /users/:id/certificates
// ─────────────────────────────────────────
const getCertificates = async (userId, query) => {
  await ensureUser(userId);
  const { filter, page, limit, skip } = buildQuery('student', userId, query);

  const [items, total] = await runPaged(Certificate, filter, { skip, limit }, {
    sort: { issuedAt: -1, _id: -1 },
    populate: [{ path: 'course', select: 'title' }],
  });

  return {
    certificates: items.map((c) => ({
      _id: c._id,
      certificateNumber: c.certificateNumber,
      course: titleRef(c.course),
      issuedAt: c.issuedAt,
    })),
    meta: buildMeta(total, page, limit),
  };
};

// ─────────────────────────────────────────
// 5. GET /users/:id/spin-history
// ─────────────────────────────────────────
const getSpinHistory = async (userId, query) => {
  await ensureUser(userId);
  const { filter, page, limit, skip } = buildQuery('user', userId, query);

  const [items, total] = await runPaged(DailySpin, filter, { skip, limit }, {
    sort: { createdAt: -1, _id: -1 },
    populate: [{ path: 'question', select: 'question' }],
  });

  return {
    history: items.map((s) => ({
      _id: s._id,
      diamondsWon: s.diamondsWon,
      question: s.question ? { _id: s.question._id, text: s.question.question } : null,
      answeredCorrectly: s.correct === true,
      status: s.status ?? 'answered',
      createdAt: s.createdAt,
    })),
    meta: buildMeta(total, page, limit),
  };
};

// ─────────────────────────────────────────
// 6. GET /users/:id/activity — hamma rol uchun
// ─────────────────────────────────────────
const getActivity = async (userId, query) => {
  await ensureUser(userId);
  const { filter, page, limit, skip } = buildQuery('user', userId, query);
  if (query.type) filter.type = query.type;

  const [items, total] = await runPaged(UserActivity, filter, { skip, limit }, {
    sort: { createdAt: -1, _id: -1 },
    populate: [{ path: 'actor', select: ACTOR_FIELDS }],
  });

  return {
    activity: items.map((a) => ({
      _id: a._id,
      type: a.type,
      actor: actorView(a.actor),
      meta: a.meta ?? {},
      createdAt: a.createdAt,
    })),
    meta: buildMeta(total, page, limit),
  };
};

module.exports = {
  getDiamondHistory,
  getAttempts,
  getEnrollments,
  getCertificates,
  getSpinHistory,
  getActivity,
};
