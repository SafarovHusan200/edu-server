const request = require('supertest');
const app = require('../src/app');
const Quiz = require('../src/modules/quizzes/quiz.model');
const Question = require('../src/modules/questions/question.model');
const QuizShare = require('../src/modules/quizzes/quizShare.model');
const { createUser } = require('./helpers');

const setupStandaloneQuiz = async (teacherId, overrides = {}) => {
  const quiz = await Quiz.create({
    title: 'Ulashiladigan test',
    targetType: 'standalone',
    createdBy: teacherId,
    timeLimit: 30,
    isActive: true,
    targetGrades: [{ number: 4, letter: 'A' }],
    ...overrides,
  });

  await Question.create({
    quiz: quiz._id,
    text: '2 + 2 = ?',
    type: 'multiple_choice',
    options: [{ label: 'A', text: '3' }, { label: 'B', text: '4' }],
    correctAnswer: 1,
    points: 1,
    order: 1,
  });

  return quiz;
};

describe('Quiz sharing', () => {
  test('egasi testni boshqa o\'qituvchiga telefon raqami orqali ulashadi', async () => {
    const { user: teacherA, token: tokenA } = await createUser({ role: 'teacher' });
    const { user: teacherB } = await createUser({ role: 'teacher' });
    const quiz = await setupStandaloneQuiz(teacherA._id);

    const res = await request(app)
      .post(`/api/v1/quizzes/${quiz._id}/share`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ toTeacherPhone: teacherB.phone });

    expect(res.status).toBe(201);
    expect(res.body.data.share.status).toBe('pending');

    const share = await QuizShare.findOne({ quiz: quiz._id, toTeacher: teacherB._id });
    expect(share).not.toBeNull();
  });

  test('egasi bo\'lmagan o\'qituvchi testni ulasholmaydi', async () => {
    const { user: teacherA } = await createUser({ role: 'teacher' });
    const { token: tokenB } = await createUser({ role: 'teacher' });
    const { user: teacherC } = await createUser({ role: 'teacher' });
    const quiz = await setupStandaloneQuiz(teacherA._id);

    const res = await request(app)
      .post(`/api/v1/quizzes/${quiz._id}/share`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ toTeacherPhone: teacherC.phone });

    expect(res.status).toBe(403);
  });

  test('course/lessonga bog\'langan (standalone bo\'lmagan) testni ulashib bo\'lmaydi', async () => {
    const { user: teacherA, token: tokenA } = await createUser({ role: 'teacher' });
    const { user: teacherB } = await createUser({ role: 'teacher' });
    const { createCategory, createCourse } = require('./helpers');
    const category = await createCategory();
    const course = await createCourse({ teacherId: teacherA._id, categoryId: category._id });

    const quiz = await setupStandaloneQuiz(teacherA._id, {
      targetType: 'course',
      targetId: course._id,
    });

    const res = await request(app)
      .post(`/api/v1/quizzes/${quiz._id}/share`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ toTeacherPhone: teacherB.phone });

    expect(res.status).toBe(400);
  });

  test('qabul qilingach mustaqil nusxa (savollar bilan) yaratiladi, isActive=false', async () => {
    const { user: teacherA, token: tokenA } = await createUser({ role: 'teacher' });
    const { user: teacherB, token: tokenB } = await createUser({ role: 'teacher' });
    const quiz = await setupStandaloneQuiz(teacherA._id);

    const shareRes = await request(app)
      .post(`/api/v1/quizzes/${quiz._id}/share`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ toTeacherPhone: teacherB.phone });
    const shareId = shareRes.body.data.share._id;

    const acceptRes = await request(app)
      .patch(`/api/v1/quizzes/shares/${shareId}/accept`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(acceptRes.status).toBe(200);
    const { clonedQuiz } = acceptRes.body.data;
    expect(clonedQuiz.createdBy.toString()).toBe(teacherB._id.toString());
    expect(clonedQuiz.isActive).toBe(false);

    const clonedQuestions = await Question.find({ quiz: clonedQuiz._id });
    expect(clonedQuestions).toHaveLength(1);
    expect(clonedQuestions[0].text).toBe('2 + 2 = ?');

    const share = await QuizShare.findById(shareId);
    expect(share.status).toBe('accepted');
  });

  test('rad etilgan so\'rov qayta javob berilmaydi', async () => {
    const { user: teacherA, token: tokenA } = await createUser({ role: 'teacher' });
    const { user: teacherB, token: tokenB } = await createUser({ role: 'teacher' });
    const quiz = await setupStandaloneQuiz(teacherA._id);

    const shareRes = await request(app)
      .post(`/api/v1/quizzes/${quiz._id}/share`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ toTeacherPhone: teacherB.phone });
    const shareId = shareRes.body.data.share._id;

    const rejectRes = await request(app)
      .patch(`/api/v1/quizzes/shares/${shareId}/reject`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(rejectRes.status).toBe(200);

    const secondAccept = await request(app)
      .patch(`/api/v1/quizzes/shares/${shareId}/accept`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(secondAccept.status).toBe(400);
  });

  test('boshqa o\'qituvchiga ulashilgan so\'rovni qabul qilib bo\'lmaydi', async () => {
    const { user: teacherA, token: tokenA } = await createUser({ role: 'teacher' });
    const { user: teacherB } = await createUser({ role: 'teacher' });
    const { token: tokenC } = await createUser({ role: 'teacher' });
    const quiz = await setupStandaloneQuiz(teacherA._id);

    const shareRes = await request(app)
      .post(`/api/v1/quizzes/${quiz._id}/share`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ toTeacherPhone: teacherB.phone });
    const shareId = shareRes.body.data.share._id;

    const res = await request(app)
      .patch(`/api/v1/quizzes/shares/${shareId}/accept`)
      .set('Authorization', `Bearer ${tokenC}`);

    expect(res.status).toBe(403);
  });
});
