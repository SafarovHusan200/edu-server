const request = require('supertest');
const app = require('../src/app');
const Quiz = require('../src/modules/quizzes/quiz.model');
const Question = require('../src/modules/questions/question.model');
const QuizAttempt = require('../src/modules/quiz-attempts/quizAttempt.model');
const { createUser } = require('./helpers');

const setupQuiz = async (teacherId, overrides = {}) => {
  const quiz = await Quiz.create({
    title: 'Matematika testi',
    targetType: 'standalone',
    createdBy: teacherId,
    passingScore: 50,
    maxAttempts: 1,
    timeLimit: 30,
    isActive: true,
    // createUser({role:'student'}) helperning standart grade'i {number:5, letter:'A'} —
    // shu sinf uchun mo'ljallanmasa startAttempt 403 qaytaradi (letter:null — 5-sinfning
    // barcha parallellari, ya'ni 'A' ham shu ichiga kiradi)
    targetGrades: [{ number: 5, letter: null }],
    ...overrides,
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

  const tf = await Question.create({
    quiz: quiz._id,
    text: 'Yer dumaloqmi?',
    type: 'true_false',
    correctAnswer: true,
    points: 1,
    order: 2,
  });

  return { quiz, mcq, tf };
};

describe('Quiz attempts', () => {
  test('to\'g\'ri javoblar bilan submit qilinsa ball to\'g\'ri hisoblanadi', async () => {
    const { user: teacher } = await createUser({ role: 'teacher' });
    const { token: studentToken } = await createUser({ role: 'student' });
    const { quiz, mcq, tf } = await setupQuiz(teacher._id);

    const startRes = await request(app)
      .post(`/api/v1/quizzes/${quiz._id}/start`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(startRes.status).toBe(201);
    const attemptId = startRes.body.data.attempt._id;

    const submitRes = await request(app)
      .post(`/api/v1/quizzes/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        answers: [
          { questionId: mcq._id.toString(), givenAnswer: 1 },
          { questionId: tf._id.toString(), givenAnswer: true },
        ],
      });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.attempt.scorePercent).toBe(100);
    expect(submitRes.body.data.attempt.passed).toBe(true);
  });

  test('maxAttempts dan ko\'p marta boshlab bo\'lmaydi', async () => {
    const { user: teacher } = await createUser({ role: 'teacher' });
    const { token: studentToken } = await createUser({ role: 'student' });
    const { quiz, mcq, tf } = await setupQuiz(teacher._id, { maxAttempts: 1 });

    const startRes = await request(app)
      .post(`/api/v1/quizzes/${quiz._id}/start`)
      .set('Authorization', `Bearer ${studentToken}`);

    const attemptId = startRes.body.data.attempt._id;

    await request(app)
      .post(`/api/v1/quizzes/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        answers: [
          { questionId: mcq._id.toString(), givenAnswer: 1 },
          { questionId: tf._id.toString(), givenAnswer: true },
        ],
      });

    const secondStartRes = await request(app)
      .post(`/api/v1/quizzes/${quiz._id}/start`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(secondStartRes.status).toBe(400);
  });

  test('vaqt limiti tugagandan so\'ng submit qilinsa attempt "expired" bo\'ladi', async () => {
    const { user: teacher } = await createUser({ role: 'teacher' });
    const { token: studentToken } = await createUser({ role: 'student' });
    const { quiz, mcq, tf } = await setupQuiz(teacher._id, { timeLimit: 10 });

    const startRes = await request(app)
      .post(`/api/v1/quizzes/${quiz._id}/start`)
      .set('Authorization', `Bearer ${studentToken}`);

    const attemptId = startRes.body.data.attempt._id;

    // Boshlangan vaqtni orqaga suramiz — 10 daqiqalik limit allaqachon tugagan bo'lsin
    await QuizAttempt.findByIdAndUpdate(attemptId, {
      startedAt: new Date(Date.now() - 20 * 60 * 1000),
    });

    const submitRes = await request(app)
      .post(`/api/v1/quizzes/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        answers: [
          { questionId: mcq._id.toString(), givenAnswer: 1 },
          { questionId: tf._id.toString(), givenAnswer: true },
        ],
      });

    expect(submitRes.status).toBe(400);

    const attempt = await QuizAttempt.findById(attemptId);
    expect(attempt.status).toBe('expired');
    expect(attempt.scorePercent).toBe(0);
  });

  test('boshqa teacher quiz natijalarini ko\'ra olmaydi', async () => {
    const { user: teacher } = await createUser({ role: 'teacher' });
    const { token: otherTeacherToken } = await createUser({ role: 'teacher' });
    const { quiz } = await setupQuiz(teacher._id);

    const res = await request(app)
      .get(`/api/v1/quizzes/${quiz._id}/results`)
      .set('Authorization', `Bearer ${otherTeacherToken}`);

    expect(res.status).toBe(403);
  });

  test('egasi yoki boshqa student attemptni ko\'rolmaydi, lekin admin ko\'ra oladi', async () => {
    const { user: teacher } = await createUser({ role: 'teacher' });
    const { token: studentToken } = await createUser({ role: 'student' });
    const { token: otherStudentToken } = await createUser({ role: 'student' });
    const { token: adminToken } = await createUser({ role: 'admin' });
    const { quiz } = await setupQuiz(teacher._id);

    const startRes = await request(app)
      .post(`/api/v1/quizzes/${quiz._id}/start`)
      .set('Authorization', `Bearer ${studentToken}`);
    const attemptId = startRes.body.data.attempt._id;

    const ownerRes = await request(app)
      .get(`/api/v1/quizzes/attempts/${attemptId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(ownerRes.status).toBe(200);

    const otherRes = await request(app)
      .get(`/api/v1/quizzes/attempts/${attemptId}`)
      .set('Authorization', `Bearer ${otherStudentToken}`);
    expect(otherRes.status).toBe(403);

    const adminRes = await request(app)
      .get(`/api/v1/quizzes/attempts/${attemptId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);
  });

  test('superadmin xato ketgan urinishni o\'chira oladi, berilgan diamond qaytariladi, student qayta urinishi mumkin', async () => {
    const { user: teacher } = await createUser({ role: 'teacher' });
    const { user: student, token: studentToken } = await createUser({ role: 'student' });
    const { token: superadminToken } = await createUser({ role: 'superadmin' });
    const { quiz, mcq, tf } = await setupQuiz(teacher._id, { maxAttempts: 1 });

    const startRes = await request(app)
      .post(`/api/v1/quizzes/${quiz._id}/start`)
      .set('Authorization', `Bearer ${studentToken}`);
    const attemptId = startRes.body.data.attempt._id;

    await request(app)
      .post(`/api/v1/quizzes/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        answers: [
          { questionId: mcq._id.toString(), givenAnswer: 1 },
          { questionId: tf._id.toString(), givenAnswer: true },
        ],
      });

    const studentAfterSubmit = await require('../src/modules/users/user.model').findById(student._id);
    expect(studentAfterSubmit.diamonds).toBeGreaterThan(0);

    const deleteRes = await request(app)
      .delete(`/api/v1/quizzes/attempts/${attemptId}`)
      .set('Authorization', `Bearer ${superadminToken}`);

    expect(deleteRes.status).toBe(200);

    const deletedAttempt = await QuizAttempt.findById(attemptId);
    expect(deletedAttempt).toBeNull();

    const studentAfterDelete = await require('../src/modules/users/user.model').findById(student._id);
    expect(studentAfterDelete.diamonds).toBe(0);

    const secondStartRes = await request(app)
      .post(`/api/v1/quizzes/${quiz._id}/start`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(secondStartRes.status).toBe(201);
  });

  test('teacher/admin urinishni o\'chira olmaydi, faqat superadmin', async () => {
    const { user: teacher, token: teacherToken } = await createUser({ role: 'teacher' });
    const { token: studentToken } = await createUser({ role: 'student' });
    const { quiz, mcq, tf } = await setupQuiz(teacher._id);

    const startRes = await request(app)
      .post(`/api/v1/quizzes/${quiz._id}/start`)
      .set('Authorization', `Bearer ${studentToken}`);
    const attemptId = startRes.body.data.attempt._id;

    const res = await request(app)
      .delete(`/api/v1/quizzes/attempts/${attemptId}`)
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(403);
  });

  test('vaqt tugashi xatosida code: "ATTEMPT_EXPIRED" keladi', async () => {
    const { user: teacher } = await createUser({ role: 'teacher' });
    const { token: studentToken } = await createUser({ role: 'student' });
    const { quiz, mcq, tf } = await setupQuiz(teacher._id, { timeLimit: 10 });

    const startRes = await request(app)
      .post(`/api/v1/quizzes/${quiz._id}/start`)
      .set('Authorization', `Bearer ${studentToken}`);
    const attemptId = startRes.body.data.attempt._id;

    await QuizAttempt.findByIdAndUpdate(attemptId, {
      startedAt: new Date(Date.now() - 20 * 60 * 1000),
    });

    const submitRes = await request(app)
      .post(`/api/v1/quizzes/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        answers: [
          { questionId: mcq._id.toString(), givenAnswer: 1 },
          { questionId: tf._id.toString(), givenAnswer: true },
        ],
      });

    expect(submitRes.status).toBe(400);
    expect(submitRes.body.code).toBe('ATTEMPT_EXPIRED');
  });

  test('GET /quizzes — har bir test uchun questionsCount va student uchun myAttempts qaytadi', async () => {
    // premium teacher — aks holda maxAttempts standart tarifda 1gacha cheklanadi
    const { user: teacher } = await createUser({ role: 'teacher', tarif: 'premium' });
    const { token: studentToken } = await createUser({ role: 'student' });
    const { quiz, mcq, tf } = await setupQuiz(teacher._id, { maxAttempts: 3 });

    const beforeRes = await request(app)
      .get('/api/v1/quizzes')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(beforeRes.status).toBe(200);
    const beforeQuiz = beforeRes.body.data.quizzes.find((q) => q._id === quiz._id.toString());
    expect(beforeQuiz.questionsCount).toBe(2);
    expect(beforeQuiz.myAttempts).toEqual({
      attemptsUsed: 0,
      attemptsRemaining: 3,
      maxAttempts: 3,
      bestScorePercent: null,
      hasInProgress: false,
      lastStatus: null,
    });

    const startRes = await request(app)
      .post(`/api/v1/quizzes/${quiz._id}/start`)
      .set('Authorization', `Bearer ${studentToken}`);
    const attemptId = startRes.body.data.attempt._id;

    await request(app)
      .post(`/api/v1/quizzes/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        answers: [
          { questionId: mcq._id.toString(), givenAnswer: 1 },
          { questionId: tf._id.toString(), givenAnswer: true },
        ],
      });

    const afterRes = await request(app)
      .get('/api/v1/quizzes')
      .set('Authorization', `Bearer ${studentToken}`);
    const afterQuiz = afterRes.body.data.quizzes.find((q) => q._id === quiz._id.toString());

    expect(afterQuiz.myAttempts).toEqual({
      attemptsUsed: 1,
      attemptsRemaining: 2,
      maxAttempts: 3,
      bestScorePercent: 100,
      hasInProgress: false,
      lastStatus: 'reviewed',
    });

    // Login qilinmagan (anonim) so'rovda myAttempts umuman bo'lmasligi kerak
    const anonRes = await request(app).get('/api/v1/quizzes');
    const anonQuiz = anonRes.body.data.quizzes.find((q) => q._id === quiz._id.toString());
    expect(anonQuiz.myAttempts).toBeUndefined();
  });

  test('GET /quizzes/my — har bir testga stats qo\'shiladi', async () => {
    const { user: teacher, token: teacherToken } = await createUser({ role: 'teacher' });
    const { token: studentToken } = await createUser({ role: 'student' });
    const { quiz, mcq, tf } = await setupQuiz(teacher._id, { maxAttempts: 3 });

    const startRes = await request(app)
      .post(`/api/v1/quizzes/${quiz._id}/start`)
      .set('Authorization', `Bearer ${studentToken}`);
    const attemptId = startRes.body.data.attempt._id;

    await request(app)
      .post(`/api/v1/quizzes/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        answers: [
          { questionId: mcq._id.toString(), givenAnswer: 1 },
          { questionId: tf._id.toString(), givenAnswer: true },
        ],
      });

    const res = await request(app)
      .get('/api/v1/quizzes/my')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    const myQuiz = res.body.data.quizzes.find((q) => q._id === quiz._id.toString());

    expect(myQuiz.stats).toEqual({
      attemptsCount: 1,
      avgScorePercent: 100,
      passRate: 100,
      pendingReviews: 0,
    });
  });

  test('GET /quizzes/pending-reviews — ochiq savolli urinishlar navbati, eng eskisi birinchi', async () => {
    const { user: teacher, token: teacherToken } = await createUser({ role: 'teacher' });
    const { token: otherTeacherToken } = await createUser({ role: 'teacher' });
    const { token: studentToken } = await createUser({ role: 'student' });

    const quiz = await Quiz.create({
      title: 'Ochiq savolli test',
      targetType: 'standalone',
      createdBy: teacher._id,
      timeLimit: 30,
      isActive: true,
      targetGrades: [{ number: 5, letter: null }],
    });

    const openQ = await Question.create({
      quiz: quiz._id,
      text: 'Fikringizni yozing',
      type: 'open_ended',
      points: 5,
      order: 1,
    });

    const startRes = await request(app)
      .post(`/api/v1/quizzes/${quiz._id}/start`)
      .set('Authorization', `Bearer ${studentToken}`);
    const attemptId = startRes.body.data.attempt._id;

    const submitRes = await request(app)
      .post(`/api/v1/quizzes/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ answers: [{ questionId: openQ._id.toString(), givenAnswer: 'mening fikrim' }] });

    expect(submitRes.body.data.attempt.status).toBe('submitted');

    const countRes = await request(app)
      .get('/api/v1/quizzes/pending-reviews/count')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(countRes.status).toBe(200);
    expect(countRes.body.data.count).toBe(1);

    const listRes = await request(app)
      .get('/api/v1/quizzes/pending-reviews')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.total).toBe(1);
    expect(listRes.body.data.items).toHaveLength(1);
    expect(listRes.body.data.items[0].quiz.title).toBe('Ochiq savolli test');
    expect(listRes.body.data.items[0].student.name).toBeDefined();

    // Boshqa teacher (bu testning egasi emas) — navbatida ko'rinmaydi
    const otherListRes = await request(app)
      .get('/api/v1/quizzes/pending-reviews')
      .set('Authorization', `Bearer ${otherTeacherToken}`);
    expect(otherListRes.body.data.total).toBe(0);

    const otherCountRes = await request(app)
      .get('/api/v1/quizzes/pending-reviews/count')
      .set('Authorization', `Bearer ${otherTeacherToken}`);
    expect(otherCountRes.body.data.count).toBe(0);
  });
});
