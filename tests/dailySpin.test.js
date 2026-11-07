const request = require('supertest');
const app = require('../src/app');
const User = require('../src/modules/users/user.model');
const SpinQuestion = require('../src/modules/spin-questions/spinQuestion.model');
const DailySpin = require('../src/modules/daily-spin/dailySpin.model');
const { createUser } = require('./helpers');

// createUser helper studentlarga default grade.number=5 beradi (tests/helpers.js)
const GRADE = 5;

const seedQuestion = async (overrides = {}) => {
  const { user: admin } = await createUser({ role: 'admin' });
  return SpinQuestion.create({
    grade: GRADE,
    question: '2 + 2 nechiga teng?',
    options: ['3', '4', '5', '6'],
    correctIndex: 1,
    createdBy: admin._id,
    ...overrides,
  });
};

describe('Daily Spin — savol-javob orqali diamond (2026-11-02)', () => {
  test('POST /daily-spin/spin — savol qaytaradi, diamond berilmaydi, correctIndex oshkor qilinmaydi', async () => {
    await seedQuestion();
    const { token } = await createUser({ role: 'student', grade: { number: GRADE, letter: 'A' } });

    const res = await request(app).post('/api/v1/daily-spin/spin').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.question.question).toBe('2 + 2 nechiga teng?');
    expect(res.body.data.question.options).toEqual(['3', '4', '5', '6']);
    expect(res.body.data.question.correctIndex).toBeUndefined();
    expect(res.body.data.diamondsWon).toBeUndefined();
    expect(res.body.data.spinsUsedToday).toBe(1);
  });

  test('to\'g\'ri javob berilsa diamond beriladi (correct:true)', async () => {
    await seedQuestion();
    const { token, user } = await createUser({ role: 'student', grade: { number: GRADE, letter: 'A' } });

    await request(app).post('/api/v1/daily-spin/spin').set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post('/api/v1/daily-spin/answer')
      .set('Authorization', `Bearer ${token}`)
      .send({ selectedIndex: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data.correct).toBe(true);
    expect(res.body.data.diamondsWon).toBeGreaterThanOrEqual(1);
    expect(res.body.data.correctIndex).toBe(1);

    const updated = await User.findById(user._id);
    expect(updated.diamonds).toBe(res.body.data.diamondsWon);
    expect(updated.pendingSpinQuestion).toBeNull();
  });

  test('noto\'g\'ri javob berilsa diamond berilmaydi (correct:false), lekin aylantirish ishlatilgan hisoblanadi', async () => {
    await seedQuestion();
    const { token, user } = await createUser({ role: 'student', grade: { number: GRADE, letter: 'A' } });

    await request(app).post('/api/v1/daily-spin/spin').set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post('/api/v1/daily-spin/answer')
      .set('Authorization', `Bearer ${token}`)
      .send({ selectedIndex: 0 });

    expect(res.status).toBe(200);
    expect(res.body.data.correct).toBe(false);
    expect(res.body.data.diamondsWon).toBe(0);
    expect(res.body.data.correctIndex).toBe(1);

    const updated = await User.findById(user._id);
    expect(updated.diamonds).toBe(0);

    // Standart tarif kuniga 1 marta — bugun uchun limit allaqachon ishlatilgan
    const secondSpin = await request(app)
      .post('/api/v1/daily-spin/spin')
      .set('Authorization', `Bearer ${token}`);
    expect(secondSpin.status).toBe(400);
  });

  test('javob berilmasdan qayta aylantirishga urinilsa "avval oldingi savolga javob bering" xatosi', async () => {
    await seedQuestion();
    const { token } = await createUser({
      role: 'student',
      tarif: 'premium',
      grade: { number: GRADE, letter: 'A' },
    });

    await request(app).post('/api/v1/daily-spin/spin').set('Authorization', `Bearer ${token}`);
    const res = await request(app).post('/api/v1/daily-spin/spin').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/oldingi savolga javob bering/);
  });

  test('javobsiz aylantirmasdan /answer chaqirilsa 400', async () => {
    const { token } = await createUser({ role: 'student', grade: { number: GRADE, letter: 'A' } });

    const res = await request(app)
      .post('/api/v1/daily-spin/answer')
      .set('Authorization', `Bearer ${token}`)
      .send({ selectedIndex: 0 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Avval barabonni aylantiring/);
  });

  test('javob berish muddati o\'tgan bo\'lsa 400, va pending tozalanadi', async () => {
    await seedQuestion();
    const { token, user } = await createUser({ role: 'student', grade: { number: GRADE, letter: 'A' } });

    await request(app).post('/api/v1/daily-spin/spin').set('Authorization', `Bearer ${token}`);
    await User.findByIdAndUpdate(user._id, { pendingSpinExpiresAt: new Date(Date.now() - 1000) });

    const res = await request(app)
      .post('/api/v1/daily-spin/answer')
      .set('Authorization', `Bearer ${token}`)
      .send({ selectedIndex: 1 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/muddati tugadi/);

    const updated = await User.findById(user._id);
    expect(updated.pendingSpinQuestion).toBeNull();
  });

  test('sinf uchun savol topilmasa 400', async () => {
    const { token } = await createUser({ role: 'student', grade: { number: 9, letter: 'A' } });

    const res = await request(app).post('/api/v1/daily-spin/spin').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/savollar qo'shilmagan/);
  });

  test('mantiqiy (logic) savol sinfga qaramasdan har qanday studentga tushishi mumkin', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    await SpinQuestion.create({
      category: 'logic',
      question: 'Agar A>B va B>C bo\'lsa, A va C orasidagi munosabat qanday?',
      options: ['A<C', 'A>C', 'A=C', 'Aniqlash mumkin emas'],
      correctIndex: 1,
      createdBy: admin._id,
    });
    // Bu sinf (9) uchun bilim savoli YO'Q — faqat umumiy mantiqiy savol bor
    const { token } = await createUser({ role: 'student', grade: { number: 9, letter: 'A' } });

    const res = await request(app).post('/api/v1/daily-spin/spin').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.question.question).toMatch(/A va C orasidagi/);
  });

  test('selectedIndex noto\'g\'ri formatda bo\'lsa 422', async () => {
    await seedQuestion();
    const { token } = await createUser({ role: 'student', grade: { number: GRADE, letter: 'A' } });
    await request(app).post('/api/v1/daily-spin/spin').set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post('/api/v1/daily-spin/answer')
      .set('Authorization', `Bearer ${token}`)
      .send({ selectedIndex: 9 });

    expect(res.status).toBe(422);
  });

  test('GET /daily-spin/history — correct maydonini qaytaradi', async () => {
    await seedQuestion();
    const { token } = await createUser({ role: 'student', grade: { number: GRADE, letter: 'A' } });

    await request(app).post('/api/v1/daily-spin/spin').set('Authorization', `Bearer ${token}`);
    await request(app)
      .post('/api/v1/daily-spin/answer')
      .set('Authorization', `Bearer ${token}`)
      .send({ selectedIndex: 1 });

    const res = await request(app)
      .get('/api/v1/daily-spin/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.history[0].correct).toBe(true);
  });
});
