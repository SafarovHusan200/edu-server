// src/modules/diamond-ledger/diamondLedger.migration.js
// Bir martalik: jurnal (DiamondTransaction) paydo bo'lishidan oldingi olmos tarixini mavjud
// yozuvlardan tiklaydi. Ishga tushirish: scripts/migrateDiamondLedger.js
//
// Manbalar va miqdor qayerdan olinadi:
//   quiz   — diamondsAwarded=true urinishlar. Miqdor: attempt.diamondsEarned → o'sha paytdagi
//            bildirishnoma ("Mukofot: X diamond") → formula (premium koeffitsiyentisiz)
//   lesson — tugatilgan darslar. Miqdor: bildirishnoma meta.diamonds → LESSON_COMPLETE_REWARD
//   spin   — DailySpin.diamondsWon > 0
//   reward / reward_refund — RewardRedemption (rad etilganlari uchun qaytarish ham)
//
// O'chirilgan urinishlar, o'chirilgan bildirishnomalar va hokazo sabab tarix yig'indisi
// haqiqiy balansdan farq qilishi mumkin — shu farq bitta 'admin_adjust' yozuvi bilan
// tuzatiladi (note'da izohlangan), shunda oxirgi balanceAfter = user.diamonds bo'ladi.
//
// Idempotent: allaqachon migratsiya qilingan (migrated=true yozuvi bor) user o'tkazib
// yuboriladi. Deploydan keyin jonli yozilgan hodisalar (source + ref.id bo'yicha) takrorlanmaydi.

const User = require('../users/user.model');
const DiamondTransaction = require('./diamondTransaction.model');
const QuizAttempt = require('../quiz-attempts/quizAttempt.model');
const Enrollment = require('../enrollment/enrollment.model');
const Lesson = require('../lessons/lesson.model');
const DailySpin = require('../daily-spin/dailySpin.model');
const RewardRedemption = require('../rewards/redemption.model');
const Notification = require('../notifications/notification.model');
const { QUIZ_MAX_REWARD, LESSON_COMPLETE_REWARD } = require('../../config/gamification');

const round2 = (n) => Math.round(n * 100) / 100;
const MUKOFOT_RE = /Mukofot:\s*([\d.]+)\s*diamond/i;
const ADJUST_NOTE =
  "Migratsiya: tarixdan tiklab bo'lmagan farq (o'chirilgan urinishlar yoki jurnaldan oldingi eski ma'lumotlar)";

// Bitta foydalanuvchining tarixiy hodisalari: { source, delta, at, ref, actor, note, attemptId? }
const collectEvents = async (userId) => {
  const [attempts, enrollments, spins, redemptions] = await Promise.all([
    QuizAttempt.find({ student: userId, diamondsAwarded: true })
      .select('quiz scorePercent diamondsEarned submittedAt updatedAt')
      .populate('quiz', 'title')
      .lean(),
    Enrollment.find({ student: userId }).select('completedLessons').lean(),
    DailySpin.find({ user: userId, diamondsWon: { $gt: 0 } })
      .populate('question', 'question')
      .lean(),
    RewardRedemption.find({ student: userId }).populate('reward', 'title').lean(),
  ]);

  const notifications = await Notification.find({ user: userId, type: { $in: ['quiz', 'lesson'] } })
    .select('type message meta')
    .lean();

  const quizAmountByAttempt = new Map();
  const lessonAmountByLesson = new Map();
  for (const n of notifications) {
    if (n.type === 'quiz' && n.meta?.attemptId) {
      const match = MUKOFOT_RE.exec(n.message ?? '');
      if (match) quizAmountByAttempt.set(String(n.meta.attemptId), Number(match[1]));
    } else if (n.type === 'lesson' && n.meta?.lessonId && typeof n.meta.diamonds === 'number') {
      lessonAmountByLesson.set(String(n.meta.lessonId), n.meta.diamonds);
    }
  }

  const events = [];

  for (const a of attempts) {
    const amount =
      a.diamondsEarned ??
      quizAmountByAttempt.get(String(a._id)) ??
      round2((a.scorePercent / 100) * QUIZ_MAX_REWARD);
    if (amount > 0) {
      events.push({
        source: 'quiz',
        delta: amount,
        at: a.submittedAt ?? a.updatedAt,
        ref: { kind: 'attempt', id: a._id, title: a.quiz?.title ?? null },
        attemptId: a.diamondsEarned == null ? a._id : null,
      });
    }
  }

  const completed = enrollments.flatMap((e) => e.completedLessons ?? []);
  const lessons = await Lesson.find({ _id: { $in: completed.map((c) => c.lesson) } })
    .select('title')
    .lean();
  const lessonTitle = new Map(lessons.map((l) => [String(l._id), l.title]));
  for (const c of completed) {
    const amount = lessonAmountByLesson.get(String(c.lesson)) ?? LESSON_COMPLETE_REWARD;
    events.push({
      source: 'lesson',
      delta: amount,
      at: c.completedAt,
      ref: { kind: 'lesson', id: c.lesson, title: lessonTitle.get(String(c.lesson)) ?? null },
    });
  }

  for (const s of spins) {
    events.push({
      source: 'spin',
      delta: s.diamondsWon,
      at: s.createdAt,
      ref: { kind: 'spin', id: s._id, title: s.question?.question ?? null },
    });
  }

  for (const r of redemptions) {
    if (!(r.diamondsSpent > 0)) continue;
    const ref = { kind: 'redemption', id: r._id, title: r.reward?.title ?? null };
    events.push({ source: 'reward', delta: -r.diamondsSpent, at: r.createdAt, ref });
    if (r.status === 'rejected') {
      events.push({
        source: 'reward_refund',
        delta: r.diamondsSpent,
        at: r.rejectedAt ?? r.updatedAt,
        ref,
        actor: r.rejectedBy ?? null,
        note: r.rejectReason || null,
      });
    }
  }

  return events.filter((e) => e.at).sort((x, y) => new Date(x.at) - new Date(y.at));
};

const signed = (entry) => (entry.type === 'earn' ? entry.amount : -entry.amount);

// Qaytaradi: { status: 'skipped' | 'empty' | 'migrated', inserted, adjustment }
const migrateUser = async (user, { dryRun = false } = {}) => {
  if (await DiamondTransaction.exists({ user: user._id, migrated: true })) {
    return { status: 'skipped', inserted: 0, adjustment: 0 };
  }

  const live = await DiamondTransaction.find({ user: user._id })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  const liveKeys = new Set(live.filter((e) => e.ref).map((e) => `${e.source}:${e.ref.id}`));
  const firstLive = live[0] ?? null;

  const events = (await collectEvents(user._id)).filter(
    (e) => !liveKeys.has(`${e.source}:${e.ref.id}`)
  );

  // Jonli jurnal boshlanishidan oldingi haqiqiy balans (jurnal bo'lmasa — joriy balans)
  const target = firstLive ? round2(firstLive.balanceAfter - signed(firstLive)) : user.diamonds;

  let balance = 0;
  const docs = events.map((e) => {
    balance = round2(balance + e.delta);
    return {
      user: user._id,
      amount: Math.abs(e.delta),
      type: e.delta > 0 ? 'earn' : 'spend',
      source: e.source,
      ref: e.ref,
      balanceAfter: balance,
      note: e.note ?? null,
      actor: e.actor ?? null,
      migrated: true,
      createdAt: new Date(e.at),
    };
  });

  const diff = round2(target - balance);
  if (Math.abs(diff) >= 0.01) {
    const lastAt = docs.length ? docs[docs.length - 1].createdAt : user.createdAt ?? new Date();
    let at = new Date(lastAt.getTime() + 1);
    if (firstLive && at >= firstLive.createdAt) at = new Date(firstLive.createdAt.getTime() - 1);
    docs.push({
      user: user._id,
      amount: Math.abs(diff),
      type: diff > 0 ? 'earn' : 'spend',
      source: 'admin_adjust',
      ref: null,
      balanceAfter: target,
      note: ADJUST_NOTE,
      actor: null,
      migrated: true,
      createdAt: at,
    });
  } else if (docs.length) {
    // Yaxlitlash qoldig'i bo'lmasin — oxirgi tarixiy yozuv aynan haqiqiy balansga teng
    docs[docs.length - 1].balanceAfter = target;
  }

  if (!docs.length) return { status: 'empty', inserted: 0, adjustment: 0 };

  if (!dryRun) {
    // To'g'ridan-to'g'ri kolleksiyaga — Mongoose timestamps createdAt'ni hozirgi vaqt bilan
    // almashtirib yubormasligi uchun (tarixiy sanalar saqlanishi kerak)
    await DiamondTransaction.collection.insertMany(docs, { ordered: true });

    const backfill = events.filter((e) => e.attemptId);
    if (backfill.length) {
      await QuizAttempt.bulkWrite(
        backfill.map((e) => ({
          updateOne: {
            filter: { _id: e.attemptId, diamondsEarned: null },
            update: { $set: { diamondsEarned: e.delta } },
          },
        }))
      );
    }
  }

  return { status: 'migrated', inserted: docs.length, adjustment: Math.abs(diff) >= 0.01 ? diff : 0 };
};

const migrateAll = async ({ dryRun = false, onProgress } = {}) => {
  const totals = { users: 0, migrated: 0, skipped: 0, empty: 0, inserted: 0, adjusted: 0 };

  const cursor = User.find({ $or: [{ role: 'student' }, { diamonds: { $ne: 0 } }] })
    .select('_id diamonds createdAt')
    .lean()
    .cursor();

  for await (const user of cursor) {
    const result = await migrateUser(user, { dryRun });
    totals.users += 1;
    totals[result.status] += 1;
    totals.inserted += result.inserted;
    if (result.adjustment) totals.adjusted += 1;
    onProgress?.(totals);
  }

  return totals;
};

module.exports = { migrateUser, migrateAll, collectEvents, ADJUST_NOTE };
