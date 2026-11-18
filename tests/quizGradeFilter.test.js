const request = require('supertest');
const app = require('../src/app');
const Quiz = require('../src/modules/quizzes/quiz.model');
const QuizAttempt = require('../src/modules/quiz-attempts/quizAttempt.model');
const { createUser } = require('./helpers');

const makeQuiz = (teacherId, targetGrades, overrides = {}) =>
  Quiz.create({
    title: `Test ${targetGrades.map((g) => `${g.number}-${g.letter ?? '*'}`).join(',')}`,
    targetType: 'standalone',
    createdBy: teacherId,
    timeLimit: 20,
    isActive: true,
    targetGrades,
    ...overrides,
  });

describe('Student uchun sinf bo\'yicha test filtri', () => {
  let teacher;
  let studentToken;
  let student;
  let quiz1A;
  let quiz1All;
  let quiz4B;

  beforeEach(async () => {
    ({ user: teacher } = await createUser({ role: 'teacher' }));
    ({ user: student, token: studentToken } = await createUser({
      role: 'student',
      grade: { number: 1, letter: 'A' },
    }));
    quiz1A = await makeQuiz(teacher._id, [{ number: 1, letter: 'A' }]);
    quiz1All = await makeQuiz(teacher._id, [{ number: 1, letter: null }]);
    quiz4B = await makeQuiz(teacher._id, [{ number: 4, letter: 'B' }]);
    await makeQuiz(teacher._id, [{ number: 1, letter: 'B' }]);
  });

  test('GET /quizzes — 1-A o\'quvchi 4-B va 1-B testlarini ko\'rmaydi, letter=null 1-sinf testini ko\'radi', async () => {
    const res = await request(app)
      .get('/api/v1/quizzes')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.quizzes.map((q) => q._id).sort();
    expect(ids).toEqual([quiz1A._id.toString(), quiz1All._id.toString()].sort());
    expect(res.body.data.meta.total).toBe(2);
  });

  test('GET /quizzes — sinfi yo\'q o\'quvchi bo\'sh ro\'yxat oladi', async () => {
    // Yangi student grade'siz yaratilmaydi — eski (grade'siz) yozuvni DB'da simulyatsiya qilamiz
    const { user, token } = await createUser({ role: 'student' });
    await user.collection.updateOne({ _id: user._id }, { $unset: { grade: '' } });

    const res = await request(app).get('/api/v1/quizzes').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.quizzes).toEqual([]);
    expect(res.body.data.meta.total).toBe(0);
  });

  test('GET /quizzes — teacher/anonim uchun filtr qo\'llanmaydi', async () => {
    const res = await request(app).get('/api/v1/quizzes');
    expect(res.status).toBe(200);
    expect(res.body.data.meta.total).toBe(4);
  });

  test('GET /quizzes/:id — mos bo\'lmagan sinf testiga 403', async () => {
    const forbidden = await request(app)
      .get(`/api/v1/quizzes/${quiz4B._id}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.message).toBe('Bu test sizning sinfingiz uchun emas');

    const ok = await request(app)
      .get(`/api/v1/quizzes/${quiz1All._id}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(ok.status).toBe(200);
  });

  test('POST /quizzes/:id/start — mos bo\'lmagan sinf testiga 403', async () => {
    const res = await request(app)
      .post(`/api/v1/quizzes/${quiz4B._id}/start`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Bu test sizning sinfingiz uchun emas');
  });

  test('GET /stats/student — activeQuizzesCount: sinf, vaqt oralig\'i va urinishlar hisobga olinadi', async () => {
    const hour = 60 * 60 * 1000;
    // Hali boshlanmagan va muddati o'tgan testlar hisobga kirmaydi
    await makeQuiz(teacher._id, [{ number: 1, letter: 'A' }], {
      availableFrom: new Date(Date.now() + hour),
    });
    await makeQuiz(teacher._id, [{ number: 1, letter: null, availableUntil: new Date(Date.now() - hour) }]);
    // Faol emas
    await makeQuiz(teacher._id, [{ number: 1, letter: 'A' }], { isActive: false });
    // Urinishlari tugagan (standart tarif — 1 urinish)
    const exhausted = await makeQuiz(teacher._id, [{ number: 1, letter: 'A' }]);
    await QuizAttempt.create({
      quiz: exhausted._id,
      student: student._id,
      attemptNumber: 1,
      startedAt: new Date(),
    });

    const res = await request(app)
      .get('/api/v1/stats/student')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    // Faqat quiz1A va quiz1All
    expect(res.body.data.stats.activeQuizzesCount).toBe(2);
  });
});
