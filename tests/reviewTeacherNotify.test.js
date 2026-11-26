// Ochiq savollar baholangach o'qituvchiga ham "📥 Yangi natija" xabari boradi:
// saytda baholansa — ilova + Telegram, botda baholansa — faqat ilova (bot o'zi yuboradi)
jest.mock('../src/bot/telegramNotifier');

const request = require('supertest');
const app = require('../src/app');
const { sendTelegramMessage } = require('../src/bot/telegramNotifier');
const Quiz = require('../src/modules/quizzes/quiz.model');
const Question = require('../src/modules/questions/question.model');
const Notification = require('../src/modules/notifications/notification.model');
const quizAttemptService = require('../src/modules/quiz-attempts/quizAttempt.service');
const { createUser } = require('./helpers');

const TEACHER_TG = 777000111;

const setup = async () => {
  const { user: teacher, token: teacherToken } = await createUser({ role: 'teacher', telegramId: TEACHER_TG });
  const { user: student, token: studentToken } = await createUser({
    role: 'student',
    name: 'Sharipova Munira',
    grade: { number: 7, letter: 'A' },
  });

  const quiz = await Quiz.create({
    title: 'ENGLISH easy',
    targetType: 'standalone',
    createdBy: teacher._id,
    passingScore: 50,
    timeLimit: 30,
    isActive: true,
    targetGrades: [{ number: 7, letter: null }],
  });
  const openQ = await Question.create({ quiz: quiz._id, text: 'Yozing', type: 'open_ended', points: 5, order: 1 });

  const startRes = await request(app)
    .post(`/api/v1/quizzes/${quiz._id}/start`)
    .set('Authorization', `Bearer ${studentToken}`);
  const attemptId = startRes.body.data.attempt._id;

  await request(app)
    .post(`/api/v1/quizzes/attempts/${attemptId}/submit`)
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ answers: [{ questionId: openQ._id.toString(), givenAnswer: 'javob' }] });

  sendTelegramMessage.mockClear();
  return { teacher, teacherToken, student, attemptId, openQ };
};

const reviewed = (openQ) => [{ questionId: openQ._id.toString(), pointsEarned: 5, isCorrect: true }];

describe("Ochiq savol baholangach o'qituvchiga natija xabari", () => {
  beforeEach(() => sendTelegramMessage.mockResolvedValue(undefined));

  test('saytda baholansa — ilovada va Telegram\'da "Yangi natija" (sinf bilan)', async () => {
    const { teacher, teacherToken, attemptId, openQ } = await setup();

    const res = await request(app)
      .patch(`/api/v1/quizzes/attempts/${attemptId}/review`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ reviewedAnswers: reviewed(openQ) });
    expect(res.status).toBe(200);

    const notif = await Notification.findOne({ user: teacher._id, title: /Yangi natija/ });
    expect(notif).not.toBeNull();
    expect(notif.message).toContain('Sharipova Munira');
    expect(notif.message).toContain('7-A');
    expect(notif.message).toContain('ENGLISH easy');
    expect(notif.message).toContain("1/1 to'g'ri (100%)");

    const teacherCalls = sendTelegramMessage.mock.calls.filter(([tgId]) => tgId === TEACHER_TG);
    expect(teacherCalls).toHaveLength(1);
    expect(teacherCalls[0][1]).toContain('📥 Yangi natija');
    expect(teacherCalls[0][1]).toContain('🏫 Sinf: 7-A');
  });

  test("botda baholansa (fromBot) — ilovada bor, Telegram nusxasi yuborilmaydi", async () => {
    const { teacher, attemptId, openQ } = await setup();

    await quizAttemptService.reviewOpenEnded(attemptId, teacher._id, reviewed(openQ), { fromBot: true });

    expect(await Notification.countDocuments({ user: teacher._id, title: /Yangi natija/ })).toBe(1);
    expect(sendTelegramMessage.mock.calls.filter(([tgId]) => tgId === TEACHER_TG)).toHaveLength(0);
  });
});
