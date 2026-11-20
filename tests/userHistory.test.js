const request = require('supertest');
const app = require('../src/app');
const User = require('../src/modules/users/user.model');
const Quiz = require('../src/modules/quizzes/quiz.model');
const Question = require('../src/modules/questions/question.model');
const QuizAttempt = require('../src/modules/quiz-attempts/quizAttempt.model');
const Reward = require('../src/modules/rewards/reward.model');
const RewardRedemption = require('../src/modules/rewards/redemption.model');
const SpinQuestion = require('../src/modules/spin-questions/spinQuestion.model');
const DailySpin = require('../src/modules/daily-spin/dailySpin.model');
const Enrollment = require('../src/modules/enrollment/enrollment.model');
const Certificate = require('../src/modules/certificates/certificate.model');
const Notification = require('../src/modules/notifications/notification.model');
const DiamondTransaction = require('../src/modules/diamond-ledger/diamondTransaction.model');
const UserActivity = require('../src/modules/user-activity/userActivity.model');
const { migrateUser, ADJUST_NOTE } = require('../src/modules/diamond-ledger/diamondLedger.migration');
const { createUser, createCategory, createCourse } = require('./helpers');

const HISTORY_PATHS = [
  'diamond-history',
  'attempts',
  'enrollments',
  'certificates',
  'spin-history',
  'activity',
];

const setupQuiz = async (teacherId) => {
  const quiz = await Quiz.create({
    title: 'Kasrlar — nazorat ishi',
    targetType: 'standalone',
    createdBy: teacherId,
    passingScore: 50,
    maxAttempts: 1,
    timeLimit: 30,
    isActive: true,
    targetGrades: [{ number: 5, letter: null }],
  });
  const mcq = await Question.create({
    quiz: quiz._id,
    text: '2 + 2 = ?',
    type: 'multiple_choice',
    options: [{ label: 'A', text: '3' }, { label: 'B', text: '4' }],
    correctAnswer: 1,
    points: 1,
    order: 1,
  });
  return { quiz, mcq };
};

// Studentga 100% natija bilan test topshirtiradi → standart tarifda 10 olmos
const passQuiz = async (studentToken, teacherId) => {
  const { quiz, mcq } = await setupQuiz(teacherId);
  const start = await request(app)
    .post(`/api/v1/quizzes/${quiz._id}/start`)
    .set('Authorization', `Bearer ${studentToken}`);
  const attemptId = start.body.data.attempt._id;
  await request(app)
    .post(`/api/v1/quizzes/attempts/${attemptId}/submit`)
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ answers: [{ questionId: mcq._id.toString(), givenAnswer: 1 }] });
  return { quiz, attemptId };
};

describe('Admin: foydalanuvchi tarixi endpointlari', () => {
  let admin;
  let adminToken;
  let superadmin;
  let superToken;
  let teacher;
  let teacherToken;
  let student;
  let studentToken;

  beforeEach(async () => {
    ({ user: admin, token: adminToken } = await createUser({ role: 'admin', name: 'Admin Aka' }));
    ({ user: superadmin, token: superToken } = await createUser({ role: 'superadmin' }));
    ({ user: teacher, token: teacherToken } = await createUser({ role: 'teacher' }));
    ({ user: student, token: studentToken } = await createUser({ role: 'student' }));
  });

  const get = (path, query = {}, token = adminToken) =>
    request(app).get(`/api/v1/users/${path}`).query(query).set('Authorization', `Bearer ${token}`);

  describe('ruxsat va validatsiya', () => {
    test.each(HISTORY_PATHS)('%s — teacher/student 403, yo\'q id 404, noto\'g\'ri id 422', async (p) => {
      expect((await get(`${student._id}/${p}`, {}, teacherToken)).status).toBe(403);
      expect((await get(`${student._id}/${p}`, {}, studentToken)).status).toBe(403);

      const missing = await get(`6a0000000000000000000000/${p}`);
      expect(missing.status).toBe(404);
      expect(missing.body.message).toBe('Foydalanuvchi topilmadi');

      const bad = await get(`not-an-id/${p}`);
      expect(bad.status).toBe(422);
      expect(bad.body.errors[0].field).toBe('id');
    });

    test.each([
      [{ page: 0 }],
      [{ limit: 101 }],
      [{ limit: 'abc' }],
      [{ from: 'kecha' }],
      [{ type: 'gift' }],
      [{ source: 'casino' }],
    ])('diamond-history noto\'g\'ri query %j — 422', async (query) => {
      const res = await get(`${student._id}/diamond-history`, query);
      expect(res.status).toBe(422);
      expect(res.body.errors[0]).toHaveProperty('field');
    });

    test('bo\'sh parametrlar filtrsiz hisoblanadi, default limit 20', async () => {
      const res = await get(`${student._id}/attempts`, { status: '', from: '', page: '' });
      expect(res.status).toBe(200);
      expect(res.body.data.meta).toEqual({ total: 0, page: 1, limit: 20, totalPages: 1 });
    });

    test('student bo\'lmagan foydalanuvchi — bo\'sh ro\'yxat, xato emas', async () => {
      const res = await get(`${teacher._id}/diamond-history`);
      expect(res.status).toBe(200);
      expect(res.body.data.history).toEqual([]);
      expect(res.body.data.summary).toEqual({ totalEarned: 0, totalSpent: 0, balance: 0 });
    });
  });

  describe('diamond-history — har bir olmos o\'zgarishi jurnalda', () => {
    test('test, spin, sovg\'a so\'rash/rad etish, urinishni o\'chirish — har biri bitta yozuv', async () => {
      // 1) Test: 100% → +10
      const { attemptId } = await passQuiz(studentToken, teacher._id);

      // 2) Spin: to'g'ri javob → + (1..N)
      await SpinQuestion.create({
        grade: 5,
        question: '7 × 8 = ?',
        options: ['54', '56', '58', '64'],
        correctIndex: 1,
        createdBy: admin._id,
      });
      await request(app).post('/api/v1/daily-spin/spin').set('Authorization', `Bearer ${studentToken}`);
      const spinRes = await request(app)
        .post('/api/v1/daily-spin/answer')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ selectedIndex: 1 });
      const prize = spinRes.body.data.diamondsWon;
      expect(prize).toBeGreaterThan(0);

      // 3) Sovg'a so'rash: −5, 4) admin rad etadi: +5
      const reward = await Reward.create({ title: 'Ruchka', cost: 5, isActive: true });
      const redeem = await request(app)
        .post(`/api/v1/rewards/${reward._id}/redeem`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(redeem.status).toBe(201);
      const redemptionId = redeem.body.data.redemption._id;
      await request(app)
        .patch(`/api/v1/rewards/redemptions/${redemptionId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Omborda yo\'q' });

      // 5) Superadmin urinishni o'chiradi: −10
      const del = await request(app)
        .delete(`/api/v1/quizzes/attempts/${attemptId}`)
        .set('Authorization', `Bearer ${superToken}`);
      expect(del.status).toBe(200);

      const res = await get(`${student._id}/diamond-history`);
      expect(res.status).toBe(200);
      const { history, summary, meta } = res.body.data;

      expect(meta.total).toBe(5);
      // eng yangisi birinchi
      expect(history.map((h) => h.source)).toEqual([
        'attempt_revoked',
        'reward_refund',
        'reward',
        'spin',
        'quiz',
      ]);

      const [revoked, refund, spend, spin, quiz] = history;
      expect(quiz).toMatchObject({
        amount: 10,
        type: 'earn',
        ref: { kind: 'attempt', _id: attemptId, title: 'Kasrlar — nazorat ishi' },
        actor: null,
      });
      expect(spin).toMatchObject({ amount: prize, type: 'earn', ref: { kind: 'spin', title: '7 × 8 = ?' } });
      expect(spend).toMatchObject({ amount: 5, type: 'spend', ref: { kind: 'redemption', _id: redemptionId, title: 'Ruchka' } });
      expect(refund).toMatchObject({ amount: 5, type: 'earn', note: 'Omborda yo\'q' });
      expect(refund.actor).toMatchObject({ _id: admin._id.toString(), name: 'Admin Aka', role: 'admin' });
      expect(revoked).toMatchObject({ amount: 10, type: 'spend', ref: { kind: 'attempt', _id: attemptId } });
      expect(revoked.actor.role).toBe('superadmin');

      // balans zanjiri
      expect(quiz.balanceAfter).toBe(10);
      expect(spin.balanceAfter).toBe(10 + prize);
      expect(spend.balanceAfter).toBe(5 + prize);
      expect(refund.balanceAfter).toBe(10 + prize);
      expect(revoked.balanceAfter).toBe(prize);

      const fresh = await User.findById(student._id);
      // earn: 10 (test) + prize (spin) + 5 (qaytarilgan); spend: 5 (sovg'a) + 10 (o'chirilgan urinish)
      expect(summary).toEqual({ totalEarned: 15 + prize, totalSpent: 15, balance: fresh.diamonds });
      expect(history[0].balanceAfter).toBe(fresh.diamonds);

      // filtrlar: summary filtrdan qat'i nazar o'zgarmaydi, meta.total filtr bo'yicha
      const spends = await get(`${student._id}/diamond-history`, { type: 'spend' });
      expect(spends.body.data.meta.total).toBe(2);
      expect(spends.body.data.summary).toEqual(summary);

      const quizOnly = await get(`${student._id}/diamond-history`, { source: 'quiz', type: 'earn' });
      expect(quizOnly.body.data.history).toHaveLength(1);

      const paged = await get(`${student._id}/diamond-history`, { page: 2, limit: 2 });
      expect(paged.body.data.history.map((h) => h.source)).toEqual(['reward', 'spin']);
      expect(paged.body.data.meta).toEqual({ total: 5, page: 2, limit: 2, totalPages: 3 });

      const future = await get(`${student._id}/diamond-history`, { from: '2099-01-01' });
      expect(future.body.data.meta.total).toBe(0);
    });

    test('balans yetmasa urinishni o\'chirish 0 gacha tushiradi, jurnalga haqiqiy miqdor yoziladi', async () => {
      const { attemptId } = await passQuiz(studentToken, teacher._id);
      await User.findByIdAndUpdate(student._id, { diamonds: 4 }); // 10 dan 6 tasi sarflangan deb

      await request(app)
        .delete(`/api/v1/quizzes/attempts/${attemptId}`)
        .set('Authorization', `Bearer ${superToken}`);

      const [entry] = (await get(`${student._id}/diamond-history`)).body.data.history;
      expect(entry).toMatchObject({ source: 'attempt_revoked', amount: 4, balanceAfter: 0 });
      expect((await User.findById(student._id)).diamonds).toBe(0);
    });

    test('balans yetmasa sovg\'a so\'ralmaydi va jurnalga hech narsa yozilmaydi', async () => {
      const reward = await Reward.create({ title: 'Planshet', cost: 1000, isActive: true });
      const res = await request(app)
        .post(`/api/v1/rewards/${reward._id}/redeem`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(400);
      expect(await DiamondTransaction.countDocuments({ user: student._id })).toBe(0);
    });
  });

  describe('attempts / enrollments / certificates / spin-history', () => {
    test('attempts — javoblarsiz, test nomi, diamondsEarned va davomiylik bilan', async () => {
      const { attemptId } = await passQuiz(studentToken, teacher._id);

      const res = await get(`${student._id}/attempts`);
      expect(res.status).toBe(200);
      const [a] = res.body.data.attempts;
      expect(a).toMatchObject({
        _id: attemptId,
        quiz: { title: 'Kasrlar — nazorat ishi' },
        attemptNumber: 1,
        status: 'reviewed',
        scorePercent: 100,
        earnedPoints: 1,
        totalPoints: 1,
        passed: true,
        diamondsEarned: 10,
      });
      expect(a).not.toHaveProperty('answers');
      expect(typeof a.durationSeconds).toBe('number');

      const filtered = await get(`${student._id}/attempts`, { status: 'in_progress' });
      expect(filtered.body.data.meta.total).toBe(0);
    });

    test('attempts — o\'chirilgan test uchun quiz: null', async () => {
      const { quiz } = await passQuiz(studentToken, teacher._id);
      await Quiz.deleteOne({ _id: quiz._id });
      const res = await get(`${student._id}/attempts`);
      expect(res.body.data.attempts[0].quiz).toBeNull();
    });

    test('enrollments va certificates', async () => {
      const category = await createCategory();
      const course = await createCourse({ teacherId: teacher._id, categoryId: category._id, title: 'Matematika 4-sinf' });
      await Enrollment.create({ student: student._id, course: course._id, progress: 50, status: 'active' });
      await Certificate.create({
        student: student._id,
        course: course._id,
        certificateNumber: 'EDU-2026-000123',
        pdfPath: '/uploads/certificates/x.pdf',
      });

      const enr = await get(`${student._id}/enrollments`, { status: 'active' });
      expect(enr.status).toBe(200);
      expect(enr.body.data.enrollments[0]).toMatchObject({
        course: { _id: course._id.toString(), title: 'Matematika 4-sinf' },
        progress: 50,
        completedLessonsCount: 0,
        totalLessons: 0,
        status: 'active',
        completedAt: null,
      });
      expect((await get(`${student._id}/enrollments`, { status: 'completed' })).body.data.meta.total).toBe(0);
      expect((await get(`${student._id}/enrollments`, { status: 'cancelled' })).status).toBe(422);

      const cert = await get(`${student._id}/certificates`);
      expect(cert.body.data.certificates[0]).toMatchObject({
        certificateNumber: 'EDU-2026-000123',
        course: { title: 'Matematika 4-sinf' },
      });
      expect(cert.body.data.certificates[0]).toHaveProperty('issuedAt');
    });

    test('spin-history — javob berilgan va vaqti o\'tgan savollar', async () => {
      const q = await SpinQuestion.create({
        grade: 5,
        question: '3 + 3 = ?',
        options: ['5', '6', '7', '8'],
        correctIndex: 1,
        createdBy: admin._id,
      });
      const spin = () =>
        request(app).post('/api/v1/daily-spin/spin').set('Authorization', `Bearer ${studentToken}`);
      const answer = (i) =>
        request(app)
          .post('/api/v1/daily-spin/answer')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({ selectedIndex: i });

      await spin();
      await answer(0); // noto'g'ri

      await User.findByIdAndUpdate(student._id, { spinsUsedToday: 0 });
      await spin();
      await User.findByIdAndUpdate(student._id, { pendingSpinExpiresAt: new Date(Date.now() - 1000) });
      expect((await answer(1)).status).toBe(400); // muddati o'tgan

      const res = await get(`${student._id}/spin-history`);
      expect(res.status).toBe(200);
      const [expired, wrong] = res.body.data.history;
      expect(expired).toMatchObject({ status: 'expired', diamondsWon: 0, answeredCorrectly: false });
      expect(wrong).toMatchObject({
        status: 'answered',
        diamondsWon: 0,
        answeredCorrectly: false,
        question: { _id: q._id.toString(), text: '3 + 3 = ?' },
      });

      // O'quvchining o'z tarixida (GET /daily-spin/history) vaqti o'tgani ko'rinmaydi
      const own = await request(app)
        .get('/api/v1/daily-spin/history')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(own.body.data.history ?? own.body.data).toHaveLength(1);
    });
  });

  describe('activity', () => {
    test('admin amallari to\'g\'ri actor bilan yoziladi, parol meta\'ga tushmaydi', async () => {
      const { user: pending } = await createUser({ role: 'student', isVerified: false });
      await request(app).patch(`/api/v1/users/${pending._id}/verify`).set('Authorization', `Bearer ${adminToken}`);

      const id = student._id;
      const auth = (t) => ({ Authorization: `Bearer ${t}` });
      await request(app).patch(`/api/v1/users/${id}/block`).set(auth(adminToken)).send({ isBlocked: true });
      await request(app).patch(`/api/v1/users/${id}/block`).set(auth(adminToken)).send({ isBlocked: true }); // o'zgarishsiz
      await request(app).patch(`/api/v1/users/${id}/block`).set(auth(adminToken)).send({ isBlocked: false });
      await request(app)
        .patch(`/api/v1/users/${id}`)
        .set(auth(superToken))
        .send({ name: 'Yangi Ism', tarif: 'premium', grade: { number: 4, letter: 'B' } });
      await request(app)
        .patch(`/api/v1/users/${id}/reset-password`)
        .set(auth(superToken))
        .send({ newPassword: 'NewSecret123' });
      await User.findByIdAndUpdate(id, { avatar: '/uploads/avatars/yoq.png' });
      await request(app).delete(`/api/v1/users/${id}/avatar`).set(auth(superToken));

      const res = await get(`${id}/activity`, { limit: 50 });
      expect(res.status).toBe(200);
      const byType = Object.fromEntries(res.body.data.activity.map((a) => [a.type, a]));

      expect(res.body.data.activity.filter((a) => a.type === 'blocked')).toHaveLength(1);
      expect(byType.blocked.actor).toMatchObject({ _id: admin._id.toString(), role: 'admin' });
      expect(byType.unblocked.actor.role).toBe('admin');
      expect(byType.profile_updated).toMatchObject({ meta: { fields: ['name'] } });
      expect(byType.tarif_changed.meta).toMatchObject({ from: 'standart', to: 'premium' });
      expect(byType.grade_changed.meta).toEqual({ from: '5-A', to: '4-B' });
      expect(byType.password_reset.actor.role).toBe('superadmin');
      expect(byType.avatar_removed.actor.role).toBe('superadmin');
      expect(JSON.stringify(res.body.data.activity)).not.toContain('NewSecret123');

      const verified = await get(`${pending._id}/activity`, { type: 'verified' });
      expect(verified.body.data.activity).toHaveLength(1);
      expect(verified.body.data.activity[0].actor._id).toBe(admin._id.toString());
    });

    test('login (actor null, ip/userAgent) va role_changed', async () => {
      const phone = '998911112233';
      const { user } = await createUser({ role: 'teacher', phone, password: 'secret123' });
      await request(app)
        .post('/api/v1/auth/login')
        .set('User-Agent', 'jest-agent')
        .send({ phone, password: 'secret123' });
      await request(app)
        .patch(`/api/v1/users/${user._id}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ role: 'admin' });

      const res = await get(`${user._id}/activity`);
      const login = res.body.data.activity.find((a) => a.type === 'login');
      expect(login.actor).toBeNull();
      expect(login.meta).toMatchObject({ userAgent: 'jest-agent', method: 'password' });
      expect(login.meta).toHaveProperty('ip');
      expect(JSON.stringify(login.meta)).not.toContain('secret123');

      const role = res.body.data.activity.find((a) => a.type === 'role_changed');
      expect(role.meta).toEqual({ from: 'teacher', to: 'admin' });

      const onlyLogin = await get(`${user._id}/activity`, { type: 'login' });
      expect(onlyLogin.body.data.meta.total).toBe(1);
    });

    test('premium muddati tugashi tarif_changed sifatida bir marta yoziladi', async () => {
      await User.findByIdAndUpdate(student._id, {
        tarif: 'premium',
        premiumExpiresAt: new Date(Date.now() - 1000),
      });
      await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${studentToken}`);
      await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${studentToken}`);

      const entries = await UserActivity.find({ user: student._id, type: 'tarif_changed' });
      expect(entries).toHaveLength(1);
      expect(entries[0].meta).toMatchObject({ from: 'premium', to: 'standart', reason: 'expired' });
      expect(entries[0].actor).toBeNull();
    });
  });

  describe('GET /rewards/redemptions?userId=', () => {
    test('faqat shu o\'quvchining so\'rovlari; boshqa filtrlar bilan birga; noto\'g\'ri id — 422', async () => {
      const { user: other } = await createUser({ role: 'student' });
      const reward = await Reward.create({ title: 'Kitob', cost: 1, isActive: true });
      await RewardRedemption.create([
        { student: student._id, reward: reward._id, diamondsSpent: 1 },
        { student: student._id, reward: reward._id, diamondsSpent: 1, status: 'rejected' },
        { student: other._id, reward: reward._id, diamondsSpent: 1 },
      ]);

      const list = (query) =>
        request(app)
          .get('/api/v1/rewards/redemptions')
          .query(query)
          .set('Authorization', `Bearer ${adminToken}`);

      const mine = await list({ userId: student._id.toString() });
      expect(mine.status).toBe(200);
      expect(mine.body.data.meta.total).toBe(2);
      expect(mine.body.data.redemptions.every((r) => r.student._id === student._id.toString())).toBe(true);

      const pending = await list({ userId: student._id.toString(), status: 'pending' });
      expect(pending.body.data.meta.total).toBe(1);

      const bad = await list({ userId: '123' });
      expect(bad.status).toBe(422);
      expect(bad.body.errors[0].field).toBe('userId');

      expect((await list({})).body.data.meta.total).toBe(3);
    });
  });
});

describe('Migratsiya: eski olmos tarixini jurnalga tiklash', () => {
  test('tarixiy hodisalar + farq tuzatish; oxirgi balanceAfter = user.diamonds; qayta ishga tushirish xavfsiz', async () => {
    const { user: teacher } = await createUser({ role: 'teacher' });
    const { user: rejecter } = await createUser({ role: 'admin' });
    const { user: student } = await createUser({ role: 'student' });
    const quiz = await Quiz.create({
      title: 'Eski test',
      targetType: 'standalone',
      createdBy: teacher._id,
      timeLimit: 20,
      isActive: true,
      targetGrades: [{ number: 5, letter: null }],
    });

    const day = (n) => new Date(Date.UTC(2026, 9, n));
    // Jurnaldan oldingi urinish: miqdor bildirishnomadan (premium: 7.5 emas, 11.25)
    const attempt = await QuizAttempt.create({
      quiz: quiz._id,
      student: student._id,
      attemptNumber: 1,
      scorePercent: 75,
      status: 'reviewed',
      diamondsAwarded: true,
      submittedAt: day(1),
    });
    await Notification.create({
      user: student._id,
      type: 'quiz',
      title: "Diamond qo'lga kiritdingiz!",
      message: 'Fan: "Eski test"\nMukofot: 11.25 diamond',
      meta: { quizId: quiz._id, attemptId: attempt._id },
    });
    const spin = await DailySpin.create({
      user: student._id,
      date: '2026-10-02',
      diamondsWon: 3,
      streakAtSpin: 1,
      correct: true,
    });
    await DailySpin.collection.updateOne({ _id: spin._id }, { $set: { createdAt: day(2) } });
    const reward = await Reward.create({ title: 'Ruchka', cost: 5 });
    const red = await RewardRedemption.create({
      student: student._id,
      reward: reward._id,
      diamondsSpent: 5,
      status: 'rejected',
      rejectedBy: rejecter._id,
      rejectedAt: day(4),
    });
    await RewardRedemption.collection.updateOne({ _id: red._id }, { $set: { createdAt: day(3) } });

    // Tarix: 11.25 + 3 − 5 + 5 = 14.25, lekin haqiqiy balans 20 → +5.75 tuzatish
    await User.findByIdAndUpdate(student._id, { diamonds: 20 });
    const fresh = await User.findById(student._id).lean();

    const result = await migrateUser(fresh);
    expect(result).toMatchObject({ status: 'migrated', inserted: 5, adjustment: 5.75 });

    const entries = await DiamondTransaction.find({ user: student._id }).sort({ createdAt: 1 }).lean();
    expect(entries.map((e) => [e.source, e.amount, e.balanceAfter])).toEqual([
      ['quiz', 11.25, 11.25],
      ['spin', 3, 14.25],
      ['reward', 5, 9.25],
      ['reward_refund', 5, 14.25],
      ['admin_adjust', 5.75, 20],
    ]);
    expect(entries[0].createdAt).toEqual(day(1));
    expect(String(entries[3].actor)).toBe(String(rejecter._id));
    expect(entries[4].note).toBe(ADJUST_NOTE);
    expect(entries.every((e) => e.migrated)).toBe(true);

    // urinishga diamondsEarned to'ldirildi
    expect((await QuizAttempt.findById(attempt._id)).diamondsEarned).toBe(11.25);

    // qayta ishga tushirish — hech narsa qo'shilmaydi
    expect((await migrateUser(fresh)).status).toBe('skipped');
    expect(await DiamondTransaction.countDocuments({ user: student._id })).toBe(5);
  });

  test('deploydan keyingi jonli yozuvlar takrorlanmaydi, tarix ulardan oldin joylashadi', async () => {
    const { user: student, token } = await createUser({ role: 'student' });
    const { user: teacher } = await createUser({ role: 'teacher' });

    // Eski (jurnalsiz) spin: +4
    await DailySpin.create({ user: student._id, date: '2026-10-01', diamondsWon: 4, streakAtSpin: 1, correct: true });
    await DailySpin.updateMany({}, { $set: { createdAt: new Date('2026-10-01') } }, { timestamps: false });
    await User.findByIdAndUpdate(student._id, { diamonds: 4 });

    // Deploydan keyin: jonli test (+10) — jurnalga o'zi yoziladi
    await passQuiz(token, teacher._id);
    const fresh = await User.findById(student._id).lean();
    expect(fresh.diamonds).toBe(14);

    const result = await migrateUser(fresh);
    expect(result).toMatchObject({ status: 'migrated', inserted: 1, adjustment: 0 });

    const entries = await DiamondTransaction.find({ user: student._id }).sort({ createdAt: 1 }).lean();
    expect(entries.map((e) => [e.source, e.balanceAfter, e.migrated])).toEqual([
      ['spin', 4, true],
      ['quiz', 14, false],
    ]);
  });
});
