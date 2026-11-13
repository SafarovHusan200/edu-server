const http = require('http');
const request = require('supertest');
const { io: ioClient } = require('socket.io-client');
const app = require('../src/app');
const { initSocket } = require('../src/socket');
const LiveSession = require('../src/modules/live-quiz/liveSession.model');
const Quiz = require('../src/modules/quizzes/quiz.model');
const Question = require('../src/modules/questions/question.model');
const gameManager = require('../src/modules/live-quiz/liveGame.manager');
const { createUser } = require('./helpers');

jest.mock('../src/bot/telegramNotifier');

const QUESTIONS = [
  { text: '2 + 2 = ?', options: ['3', '4', '5', '6'], correctIndex: 1, timeLimit: 20 },
  { text: "Yer quyosh atrofida aylanadimi?", options: ["To'g'ri", "Noto'g'ri"], correctIndex: 0, timeLimit: 20, pointsMultiplier: 2 },
];

let server;
let io;
let baseUrl;
const sockets = [];

beforeAll(async () => {
  server = http.createServer(app);
  io = initSocket(server);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}/live-quiz`;
});

afterEach(() => {
  sockets.splice(0).forEach((s) => s.disconnect());
  gameManager.resetAll();
});

afterAll(async () => {
  io.close();
  await new Promise((resolve) => server.close(resolve));
});

const connect = (token) =>
  new Promise((resolve, reject) => {
    const socket = ioClient(baseUrl, { auth: token ? { token } : {}, transports: ['websocket'], forceNew: true });
    sockets.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });

const call = (socket, event, payload = {}) => new Promise((resolve) => socket.emit(event, payload, resolve));
const once = (socket, event) => new Promise((resolve) => socket.once(event, resolve));
const waitFor = async (fn, timeout = 5000) => {
  const start = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - start > timeout) throw new Error('waitFor: vaqt tugadi');
    await new Promise((r) => setTimeout(r, 50));
  }
};

const createQuiz = async (token, body = { title: 'Matematika', questions: QUESTIONS }) =>
  request(app).post('/api/v1/live-quizzes').set('Authorization', `Bearer ${token}`).send(body);

describe('Jonli viktorina — REST', () => {
  test("o'qituvchi rasmli savollar bilan viktorina yaratadi, ro'yxatda questionCount ko'rinadi", async () => {
    const { token } = await createUser({ role: 'teacher' });
    const questions = [{ ...QUESTIONS[0], image: '/uploads/live-quiz/123_456.png' }, QUESTIONS[1]];

    const res = await createQuiz(token, { title: 'Rasmli', questions });
    expect(res.status).toBe(201);
    expect(res.body.data.quiz.questions[0].image).toBe('/uploads/live-quiz/123_456.png');

    const list = await request(app).get('/api/v1/live-quizzes').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data.quizzes[0].questionCount).toBe(2);
    expect(list.body.data.quizzes[0].coverImage).toBe('/uploads/live-quiz/123_456.png');
  });

  test("tashqi rasm havolasi va noto'g'ri correctIndex rad etiladi", async () => {
    const { token } = await createUser({ role: 'teacher' });

    const external = await createQuiz(token, {
      title: 'X',
      questions: [{ ...QUESTIONS[0], image: 'https://evil.example/pixel.png' }],
    });
    expect(external.status).toBe(422);

    const badIndex = await createQuiz(token, {
      title: 'X',
      questions: [{ text: '?', options: ['a', 'b'], correctIndex: 3 }],
    });
    expect(badIndex.status).toBe(422);
  });

  test("student viktorina yarata olmaydi, boshqa o'qituvchi tahrirlay olmaydi", async () => {
    const { token: studentToken } = await createUser({ role: 'student' });
    expect((await createQuiz(studentToken)).status).toBe(403);

    const { token: t1 } = await createUser({ role: 'teacher' });
    const { token: t2 } = await createUser({ role: 'teacher' });
    const quiz = (await createQuiz(t1)).body.data.quiz;

    const res = await request(app)
      .patch(`/api/v1/live-quizzes/${quiz._id}`)
      .set('Authorization', `Bearer ${t2}`)
      .send({ title: 'Buzildi' });
    expect(res.status).toBe(403);
  });

  test("savolsiz viktorina uchun o'yin boshlab bo'lmaydi; mavjud bo'lmagan PIN 404", async () => {
    const { token } = await createUser({ role: 'teacher' });
    const quiz = (await createQuiz(token, { title: "Bo'sh" })).body.data.quiz;

    const res = await request(app)
      .post(`/api/v1/live-quizzes/${quiz._id}/sessions`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);

    expect((await request(app).get('/api/v1/live-quizzes/join/000000')).status).toBe(404);
  });
});

describe('Jonli viktorina — markdown savol matni', () => {
  const withText = (text) => ({ title: 'MD', questions: [{ ...QUESTIONS[0], text }] });

  test("o'zimiz yuklagan rasmli markdown qabul qilinadi", async () => {
    const { token } = await createUser({ role: 'teacher' });
    const text = '**Rasmga qarang:**\n\n![shakl](/uploads/live-quiz/1_2.png "uchburchak")\n\nNechta burchak bor?';
    const res = await createQuiz(token, withText(text));
    expect(res.status).toBe(201);
    expect(res.body.data.quiz.questions[0].text).toBe(text);
  });

  test.each([
    ['base64 rasm', '![a](data:image/png;base64,iVBORw0KGgo=)'],
    ['tashqi havola', '![a](https://evil.example/x.png)'],
    ['HTML img', 'Savol <img src="https://evil.example/x.png">'],
    ['yo\'l chiqib ketishi', '![a](/uploads/live-quiz/../avatars/x.png)'],
    ['3 tadan ko\'p rasm', '![1](/uploads/live-quiz/1.png)![2](/uploads/live-quiz/2.png)![3](/uploads/live-quiz/3.png)![4](/uploads/live-quiz/4.png)'],
    ['2000 belgidan uzun', 'a'.repeat(2001)],
  ])('%s rad etiladi', async (_, text) => {
    const { token } = await createUser({ role: 'teacher' });
    const res = await createQuiz(token, withText(text));
    expect(res.status).toBe(422);
  });
});

describe('Jonli viktorina — testdan import', () => {
  const makeSourceQuiz = async (teacherId) => {
    const quiz = await Quiz.create({
      title: 'Fizika testi',
      description: 'Choraklik',
      targetType: 'standalone',
      createdBy: teacherId,
      timeLimit: 30,
      targetGrades: [{ number: 7, letter: null }],
    });
    await Question.create([
      { quiz: quiz._id, order: 1, text: 'Tezlik birligi?', type: 'multiple_choice', options: [{ label: 'A', text: 'm/s' }, { label: 'B', text: 'kg' }, { label: 'C', text: 'N' }], correctAnswer: 0 },
      { quiz: quiz._id, order: 2, text: "Yorug'lik tovushdan tez", type: 'true_false', correctAnswer: true },
      { quiz: quiz._id, order: 3, text: 'Nyuton qonunini tushuntiring', type: 'open_ended' },
      { quiz: quiz._id, order: 4, text: 'Besh variant', type: 'multiple_choice', options: ['1', '2', '3', '4', '5'].map((t) => ({ text: t })), correctAnswer: 2 },
      { quiz: quiz._id, order: 5, text: 'Suv qaynaydi', type: 'true_false', correctAnswer: 'false' },
    ]);
    return quiz;
  };

  test("mos savollar ko'chiriladi, mos kelmaganlari sababi bilan qaytadi", async () => {
    const { user: teacher, token } = await createUser({ role: 'teacher' });
    const source = await makeSourceQuiz(teacher._id);

    const res = await request(app)
      .post(`/api/v1/live-quizzes/import/${source._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    expect(res.body.data.imported).toBe(3);
    expect(res.body.data.skipped.map((s) => s.index)).toEqual([2, 3]);
    expect(res.body.data.skipped[0].reason).toMatch(/Ochiq javobli/);

    const { quiz } = res.body.data;
    expect(quiz.title).toBe('Fizika testi');
    expect(quiz.questions.map((q) => [q.text, q.options.length, q.correctIndex, q.timeLimit])).toEqual([
      ['Tezlik birligi?', 3, 0, 20],
      ["Yorug'lik tovushdan tez", 2, 0, 20],
      ['Suv qaynaydi', 2, 1, 20],
    ]);
    expect(quiz.questions[1].options).toEqual(["To'g'ri", "Noto'g'ri"]);
  });

  test("boshqa o'qituvchining testini import qilib bo'lmaydi; mos savol bo'lmasa 400", async () => {
    const { user: owner } = await createUser({ role: 'teacher' });
    const { token: otherToken } = await createUser({ role: 'teacher' });
    const source = await makeSourceQuiz(owner._id);

    const forbidden = await request(app)
      .post(`/api/v1/live-quizzes/import/${source._id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(forbidden.status).toBe(403);

    const { user: t2, token: t2Token } = await createUser({ role: 'teacher' });
    const onlyOpen = await Quiz.create({
      title: 'Insho',
      targetType: 'standalone',
      createdBy: t2._id,
      timeLimit: 30,
      targetGrades: [{ number: 7, letter: null }],
    });
    await Question.create({ quiz: onlyOpen._id, text: 'Yozing', type: 'open_ended' });

    const empty = await request(app)
      .post(`/api/v1/live-quizzes/import/${onlyOpen._id}`)
      .set('Authorization', `Bearer ${t2Token}`)
      .send({ title: 'Yangi nom' });
    expect(empty.status).toBe(400);
    expect(empty.body.code).toBe('NO_COMPATIBLE_QUESTIONS');
  });
});

describe('Jonli viktorina — Socket.IO oqimi', () => {
  const setupGame = async () => {
    const { user: teacher, token: teacherToken } = await createUser({ role: 'teacher' });
    const quiz = (await createQuiz(teacherToken)).body.data.quiz;
    const res = await request(app)
      .post(`/api/v1/live-quizzes/${quiz._id}/sessions`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(201);

    const host = await connect(teacherToken);
    const joined = await call(host, 'host:join', { pin: res.body.data.session.pin });
    expect(joined.ok).toBe(true);

    return { teacher, teacherToken, quiz, pin: res.body.data.session.pin, host };
  };

  test("to'liq o'yin: anonim + platforma o'yinchilari, ball, reyting, natija saqlanadi", async () => {
    const { pin, host, quiz } = await setupGame();

    const { user: student, token: studentToken } = await createUser({ role: 'student' });

    // PIN tekshiruvi (ishtirokchi sahifasi)
    const check = await request(app).get(`/api/v1/live-quizzes/join/${pin}`);
    expect(check.body.data.session).toMatchObject({ joinable: true, status: 'lobby' });

    const lobbyUpdate = once(host, 'lobby:players');
    const p1 = await connect(studentToken); // platformadagi student
    const p2 = await connect(); // anonim
    const p3 = await connect(); // anonim

    const j1 = await call(p1, 'player:join', { pin, name: '  Ali   Valiyev ' });
    expect(j1.ok).toBe(true);
    expect(j1.game.name).toBe('Ali Valiyev');
    expect((await lobbyUpdate).players[0]).toMatchObject({ name: 'Ali Valiyev', isPlatformUser: true });

    expect((await call(p2, 'player:join', { pin, name: 'Sardor' })).ok).toBe(true);

    const dup = await call(p3, 'player:join', { pin, name: 'sardor' });
    expect(dup).toMatchObject({ ok: false, code: 'NAME_TAKEN' });
    expect((await call(p3, 'player:join', { pin, name: 'Malika' })).ok).toBe(true);

    // Anonim o'yinchi host buyrug'ini bera olmaydi
    expect((await call(p2, 'host:start')).ok).toBe(false);

    // ── 1-savol ──
    const q1 = once(p1, 'question:start');
    expect((await call(host, 'host:start')).ok).toBe(true);
    const question = await q1;
    expect(question).toMatchObject({ index: 0, total: 2, text: '2 + 2 = ?' });
    expect(question.correctIndex).toBeUndefined(); // to'g'ri javob oshkor qilinmaydi

    // Boshlangandan keyin yangi o'yinchi qo'shila olmaydi
    const late = await connect();
    expect(await call(late, 'player:join', { pin, name: 'Kech' })).toMatchObject({ code: 'GAME_STARTED' });

    const r1 = once(p1, 'question:result');
    const hostEnd = once(host, 'question:end');
    expect((await call(p1, 'player:answer', { questionIndex: 0, option: 1 })).ok).toBe(true);
    expect(await call(p1, 'player:answer', { questionIndex: 0, option: 1 })).toMatchObject({ code: 'ALREADY_ANSWERED' });
    await new Promise((r) => setTimeout(r, 30));
    await call(p2, 'player:answer', { questionIndex: 0, option: 1 });
    await call(p3, 'player:answer', { questionIndex: 0, option: 2 });

    // Hamma javob berdi → savol avtomatik yopiladi
    const end1 = await hostEnd;
    expect(end1).toMatchObject({ correctIndex: 1, distribution: [0, 2, 1, 0], answered: 3, isLast: false });
    expect(end1.leaderboard[0].name).toBe('Ali Valiyev'); // eng tez to'g'ri javob

    const res1 = await r1;
    expect(res1).toMatchObject({ correct: true, rank: 1, totalPlayers: 3, streak: 1 });
    expect(res1.points).toBeGreaterThan(900);
    expect(res1.points).toBeLessThanOrEqual(1000);

    // ── 2-savol (ikki barobar ball) ──
    const q2 = once(p2, 'question:start');
    await call(host, 'host:next');
    expect((await q2).index).toBe(1);

    await call(p1, 'player:answer', { questionIndex: 1, option: 0 });
    await call(p2, 'player:answer', { questionIndex: 1, option: 1 });
    // p3 javob bermaydi — host savolni qo'lda yopadi
    const end2 = once(host, 'question:end');
    await call(host, 'host:next');
    expect((await end2).isLast).toBe(true);

    const gameEnd = once(host, 'game:end');
    const p1End = once(p1, 'game:end');
    await call(host, 'host:next');
    const final = await gameEnd;
    expect(final.podium.map((p) => p.name)).toEqual(['Ali Valiyev', 'Sardor', 'Malika']);
    expect(await p1End).toMatchObject({ rank: 1, correctCount: 2, totalQuestions: 2 });

    // Natija DB'ga saqlanadi; platformadagi o'yinchi akkauntiga bog'lanadi, anonimlar — yo'q
    const session = await waitFor(() => LiveSession.findOne({ quiz: quiz._id }));
    expect(session.players).toHaveLength(3);
    expect(session.players[0]).toMatchObject({ name: 'Ali Valiyev', rank: 1, correctCount: 2 });
    expect(session.players[0].user.toString()).toBe(student._id.toString());
    expect(session.players[1].user).toBeNull();
    expect(session.questions[0].distribution).toEqual([0, 2, 1, 0]);
  });

  test("o'yinchi qayta ulanganda (playerKey) bali saqlanib qoladi; host o'yinchini chiqara oladi", async () => {
    const { pin, host } = await setupGame();

    const p1 = await connect();
    const p2 = await connect();
    const j1 = await call(p1, 'player:join', { pin, name: 'Bobur' });
    const j2 = await call(p2, 'player:join', { pin, name: 'Dilnoza' });

    const q = once(p1, 'question:start');
    await call(host, 'host:start');
    await q;
    await call(p1, 'player:answer', { questionIndex: 0, option: 1 });

    // Dilnoza chiqarib yuboriladi → hamma (Bobur) javob bergan, savol yopiladi
    const kicked = once(p2, 'player:kicked');
    const ended = once(host, 'question:end');
    await call(host, 'host:kick', { playerId: j2.playerId });
    await kicked;
    expect((await ended).total).toBe(1);

    // Bobur sahifani yangiladi
    p1.disconnect();
    const p1b = await connect();
    const re = await call(p1b, 'player:rejoin', { pin, playerKey: j1.playerKey });
    expect(re.ok).toBe(true);
    expect(re.game.score).toBeGreaterThan(0);
    expect(re.game.playerId).toBe(j1.playerId);

    expect(await call(p1b, 'player:rejoin', { pin, playerKey: 'notogri' })).toMatchObject({ code: 'PLAYER_NOT_FOUND' });
  });

  test("boshqa o'qituvchi hostga ulana olmaydi; host:end natijani saqlaydi", async () => {
    const { pin, host } = await setupGame();

    const { token: otherTeacher } = await createUser({ role: 'teacher' });
    const intruder = await connect(otherTeacher);
    expect(await call(intruder, 'host:join', { pin })).toMatchObject({ ok: false, code: 'FORBIDDEN' });

    const p1 = await connect();
    await call(p1, 'player:join', { pin, name: "Yolg'iz" });

    const q = once(p1, 'question:start');
    await call(host, 'host:start');
    await q;
    await call(p1, 'player:answer', { questionIndex: 0, option: 1 });
    await call(host, 'host:end');

    const session = await waitFor(() => LiveSession.findOne({ pin }));
    expect(session.players[0]).toMatchObject({ name: "Yolg'iz", rank: 1, correctCount: 1 });
  });
});

describe('Jonli viktorina — ball hisoblash', () => {
  test('tez javob ko\'proq ball, noto\'g\'ri/ballsiz savol 0', () => {
    const { calcPoints } = gameManager;
    expect(calcPoints({ correct: true, elapsedMs: 0, timeLimitSec: 20, multiplier: 1 })).toBe(1000);
    expect(calcPoints({ correct: true, elapsedMs: 20000, timeLimitSec: 20, multiplier: 1 })).toBe(500);
    expect(calcPoints({ correct: true, elapsedMs: 10000, timeLimitSec: 20, multiplier: 2 })).toBe(1500);
    expect(calcPoints({ correct: false, elapsedMs: 0, timeLimitSec: 20, multiplier: 1 })).toBe(0);
    expect(calcPoints({ correct: true, elapsedMs: 0, timeLimitSec: 20, multiplier: 0 })).toBe(0);
  });
});
