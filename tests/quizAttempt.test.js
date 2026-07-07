const request = require('supertest');
const app = require('../src/app');
const Quiz = require('../src/modules/quizzes/quiz.model');
const Question = require('../src/modules/questions/question.model');
const { createUser } = require('./helpers');

const setupQuiz = async (teacherId, overrides = {}) => {
  const quiz = await Quiz.create({
    title: 'Matematika testi',
    targetType: 'standalone',
    createdBy: teacherId,
    passingScore: 50,
    maxAttempts: 1,
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

  test('boshqa teacher quiz natijalarini ko\'ra olmaydi', async () => {
    const { user: teacher } = await createUser({ role: 'teacher' });
    const { token: otherTeacherToken } = await createUser({ role: 'teacher' });
    const { quiz } = await setupQuiz(teacher._id);

    const res = await request(app)
      .get(`/api/v1/quizzes/${quiz._id}/results`)
      .set('Authorization', `Bearer ${otherTeacherToken}`);

    expect(res.status).toBe(403);
  });
});
