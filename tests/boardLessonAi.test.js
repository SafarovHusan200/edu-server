const request = require('supertest');

// Gemini SDK mock — haqiqiy tarmoq so'rovi ketmaydi. Type enum asl SDK'dan olinadi.
const mockGenerateContent = jest.fn();
jest.mock('@google/genai', () => {
  const actual = jest.requireActual('@google/genai');
  return {
    Type: actual.Type,
    GoogleGenAI: jest.fn().mockImplementation(() => ({ models: { generateContent: mockGenerateContent } })),
  };
});

const app = require('../src/app');
const { createUser } = require('./helpers');

const URL = '/api/v1/board-lessons/generate';
const BODY = { topic: "Oddiy kasrlarni qo'shish", grade: 5, subject: 'Matematika', slideCount: 4, exerciseCount: 5 };

const GOOD = {
  title: "Oddiy kasrlarni qo'shish",
  description: "Bir xil maxrajli kasrlarni qo'shishni o'rganamiz.",
  subject: 'Matematika',
  theme: 'sunset',
  slides: [
    { title: 'Pitsa savoli', body: "Pitsaning **1/4** qismi va yana 1/4 qismi — jami qancha?", icon: 'lightbulb' },
    { title: 'Qoida', body: "- Maxrajlar bir xil bo'lsa\n- **suratlar** qo'shiladi", icon: 'book' },
    { title: 'Misol', body: '3/4 + 1/4 = 4/4 = 1', icon: 'calculator' },
    { title: 'Xulosa', body: "Maxraj o'zgarmaydi", icon: 'trophy' },
  ],
  exercises: [
    { text: '1/5 + 2/5 = ?', options: ['3/5', '3/10', '2/5'], correctIndex: 0 },
    { text: '2/7 + 3/7 = ?', options: ['5/14', '5/7'], correctIndex: 1 },
  ],
};

const reply = (obj) => ({ text: typeof obj === 'string' ? obj : JSON.stringify(obj) });
const overloaded = () =>
  Object.assign(
    new Error('{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}'),
    { status: 503 }
  );

// Qayta urinishlar orasidagi kutish testlarni sekinlashtirmasin
const { retryPolicy } = require('../src/modules/board-lessons/boardLesson.ai');
const RETRY_DEFAULTS = { ...retryPolicy };
beforeEach(() => Object.assign(retryPolicy, RETRY_DEFAULTS, { delayMs: 0 }));
const post = (token, body = BODY) => request(app).post(URL).set('Authorization', `Bearer ${token}`).send(body);

let teacherToken;
const ENV = { ...process.env };

beforeEach(async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_MODEL = 'test-flash-model';
  delete process.env.GEMINI_FALLBACK_MODEL;
  mockGenerateContent.mockReset();
  ({ token: teacherToken } = await createUser({ role: 'teacher' }));
});

// AI qatlami xatolarni console.error'ga yozadi — test logini toza saqlash uchun
let consoleSpy;
beforeAll(() => {
  consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  consoleSpy.mockRestore();
  process.env = ENV;
});

describe('POST /board-lessons/generate (AI qoralama)', () => {
  test('student 403 oladi, Gemini chaqirilmaydi', async () => {
    const { token } = await createUser({ role: 'student' });
    const res = await post(token);
    expect(res.status).toBe(403);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  test("teacher qoralama oladi, bazaga saqlanmaydi; Gemini to'g'ri parametrlar bilan chaqiriladi", async () => {
    mockGenerateContent.mockResolvedValue(reply(GOOD));

    const res = await post(teacherToken);
    expect(res.status).toBe(200);
    const { draft } = res.body.data;
    expect(draft).toMatchObject({ title: GOOD.title, grade: 5, subject: 'Matematika', theme: 'sunset' });
    expect(draft.slides).toHaveLength(4);
    expect(draft.slides[0]).toEqual({ ...GOOD.slides[0], layout: 'text', image: null, theme: null });
    expect(draft.exercises[1]).toEqual({ ...GOOD.exercises[1], image: null });

    const [args] = mockGenerateContent.mock.calls[0];
    expect(args.model).toBe('test-flash-model');
    expect(args.config).toMatchObject({ responseMimeType: 'application/json', temperature: 0.7 });
    expect(args.config.responseSchema.properties.slides.maxItems).toBe('4');
    expect(args.config.systemInstruction).toMatch(/5-sinf/);
    // O'qituvchi matni alohida ma'lumot blokida
    expect(args.contents).toMatch(/O'QITUVCHI KIRITGAN MA'LUMOT/);

    const list = await request(app).get('/api/v1/board-lessons').set('Authorization', `Bearer ${teacherToken}`);
    expect(list.body.data.meta.total).toBe(0);
  });

  test('buzilgan AI javobi serverda tozalanadi', async () => {
    mockGenerateContent.mockResolvedValue(
      reply({
        title: 'T'.repeat(300),
        description: 'Tavsif <script>alert(1)</script> [havola](https://x.uz)',
        theme: 'neon',
        slides: [
          { title: 'Rasmli', body: 'Matn ![r](https://evil.com/a.png) <img src=x> https://spam.uz oxiri', icon: 'dragon' },
          { title: '', body: '   ' }, // bo'sh — tashlanadi
          { title: 'Uchinchi', body: 'ok', icon: 'atom', layout: 'split', image: '/x.png' },
        ],
        exercises: [
          { text: 'Index chegaradan tashqarida', options: ['a', 'b'], correctIndex: 5 }, // tashlanadi
          { text: '5 ta variant', options: ['A', 'B', 'C', 'D', 'E'], correctIndex: 4 },
          { text: "Bo'sh variant", options: ['', 'x', ' '], correctIndex: 1 }, // 1 ta qoladi — tashlanadi
          { text: "Bo'sh variant 2", options: ['', 'x', 'y'], correctIndex: 2 },
          { text: 'Index manfiy', options: ['a', 'b'], correctIndex: -1 }, // tashlanadi
        ],
      })
    );

    const res = await post(teacherToken);
    expect(res.status).toBe(200);
    const { draft } = res.body.data;

    expect(draft.title).toHaveLength(120);
    expect(draft.theme).toBe('ocean');
    expect(draft.description).not.toMatch(/<|https?:/);
    expect(draft.description).toMatch(/havola/);

    expect(draft.slides).toHaveLength(2);
    expect(draft.slides[0].icon).toBe('lightbulb');
    expect(draft.slides[0].body).not.toMatch(/!\[|<img|https?:|spam\.uz/);
    expect(draft.slides[1]).toMatchObject({ icon: 'atom', layout: 'text', image: null });

    expect(draft.exercises).toEqual([
      { text: '5 ta variant', options: ['A', 'B', 'C', 'E'], correctIndex: 3, image: null },
      { text: "Bo'sh variant 2", options: ['x', 'y'], correctIndex: 1, image: null },
    ]);
  });

  test("JSON buzilgan bo'lsa 1 marta qayta urinadi", async () => {
    mockGenerateContent.mockResolvedValueOnce(reply('{"title": "yarim')).mockResolvedValueOnce(reply(GOOD));

    const res = await post(teacherToken);
    expect(res.status).toBe(200);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  test("ikki marta buzilgan JSON — 502", async () => {
    mockGenerateContent.mockResolvedValue(reply('bu JSON emas'));

    const res = await post(teacherToken);
    expect(res.status).toBe(502);
    expect(res.body.message).toMatch(/AI javobini o'qib bo'lmadi/);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  test("yaroqli slayd ham mashq ham qolmasa — 502", async () => {
    mockGenerateContent.mockResolvedValue(reply({ title: 'X', slides: [], exercises: [{ text: 'a', options: ['a'], correctIndex: 0 }] }));
    expect((await post(teacherToken)).status).toBe(502);
  });

  test("kalit yo'q — 503 'AI xizmati sozlanmagan', Gemini chaqirilmaydi", async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await post(teacherToken);
    expect(res.status).toBe(503);
    expect(res.body.message).toBe('AI xizmati sozlanmagan');
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  test('provayder 429 / RESOURCE_EXHAUSTED — bizda ham 429, tafsilot ko\'rinmaydi', async () => {
    mockGenerateContent.mockRejectedValue(Object.assign(new Error('RESOURCE_EXHAUSTED: quota key=test-key'), { status: 429 }));

    const res = await post(teacherToken);
    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/AI limiti vaqtincha tugadi/);
    expect(JSON.stringify(res.body)).not.toMatch(/test-key|RESOURCE_EXHAUSTED/);
  });

  test("model band (503 high demand) — qayta uriniladi, keyin muvaffaqiyat", async () => {
    mockGenerateContent
      .mockRejectedValueOnce(overloaded())
      .mockRejectedValueOnce(overloaded())
      .mockResolvedValueOnce(reply(GOOD));

    expect((await post(teacherToken)).status).toBe(200);
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    expect(mockGenerateContent.mock.calls.every(([args]) => args.model === 'test-flash-model')).toBe(true);
  });

  test("asosiy model band — darhol GEMINI_FALLBACK_MODEL'ga o'tiladi", async () => {
    process.env.GEMINI_FALLBACK_MODEL = 'test-fallback-model';
    mockGenerateContent.mockImplementation(async ({ model }) => {
      if (model === 'test-flash-model') throw overloaded();
      return reply(GOOD);
    });

    expect((await post(teacherToken)).status).toBe(200);
    const models = mockGenerateContent.mock.calls.map(([args]) => args.model);
    expect(models).toEqual(['test-flash-model', 'test-fallback-model']);
  });

  test("hammasi band — 503 va aniq xabar, tafsilot ko'rinmaydi", async () => {
    process.env.GEMINI_FALLBACK_MODEL = 'test-fallback-model';
    mockGenerateContent.mockRejectedValue(overloaded());

    const res = await post(teacherToken);
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/AI hozir juda band/);
    expect(JSON.stringify(res.body)).not.toMatch(/high demand|UNAVAILABLE/);
    // asosiy → zaxira → asosiy (maxAttempts = 3)
    expect(mockGenerateContent.mock.calls.map(([args]) => args.model)).toEqual([
      'test-flash-model',
      'test-fallback-model',
      'test-flash-model',
    ]);
  });

  test("asosiy model javob bermasa (timeout) — zaxiraga o'tiladi, umumiy vaqt cheklangan", async () => {
    process.env.GEMINI_FALLBACK_MODEL = 'test-fallback-model';
    Object.assign(retryPolicy, { attemptTimeoutMs: 100, budgetMs: 1000, minAttemptMs: 0 });
    mockGenerateContent.mockImplementation(({ model }) =>
      model === 'test-flash-model' ? new Promise(() => {}) : Promise.resolve(reply(GOOD))
    );

    expect((await post(teacherToken)).status).toBe(200);
    expect(mockGenerateContent.mock.calls.map(([args]) => args.model)).toEqual(['test-flash-model', 'test-fallback-model']);
  });

  test("biri band, keyingisi timeout — 'band' xabari ko'rsatiladi", async () => {
    Object.assign(retryPolicy, { attemptTimeoutMs: 100, budgetMs: 1000, minAttemptMs: 0, maxAttempts: 2 });
    mockGenerateContent.mockRejectedValueOnce(overloaded()).mockImplementationOnce(() => new Promise(() => {}));

    const res = await post(teacherToken);
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/AI hozir juda band/);
  });

  test("vaqt tugasa — yangi urinish boshlanmaydi, 504", async () => {
    Object.assign(retryPolicy, { budgetMs: 200, minAttemptMs: 150 });
    mockGenerateContent.mockImplementation(() => new Promise(() => {}));

    expect((await post(teacherToken)).status).toBe(504);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  test("boshqa 5xx xatolar qayta urinilmaydi", async () => {
    mockGenerateContent.mockRejectedValue(Object.assign(new Error('Internal'), { status: 500 }));
    expect((await post(teacherToken)).status).toBe(503);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  test('validatsiya xatolari — 422, Gemini chaqirilmaydi', async () => {
    const res = await post(teacherToken, {
      topic: 'ab',
      grade: 12,
      slideCount: 5,
      exerciseCount: 7,
      notes: 'x'.repeat(301),
      subject: 'y'.repeat(61),
    });
    expect(res.status).toBe(422);
    expect(res.body.errors.map((e) => e.field)).toEqual(
      expect.arrayContaining(['topic', 'grade', 'slideCount', 'exerciseCount', 'notes', 'subject'])
    );
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });
});

describe('GEMINI_BASE_URL (proksi)', () => {
  const { GoogleGenAI } = require('@google/genai');

  test("berilsa — client shu baseUrl bilan yaratiladi, berilmasa — standart manzil", async () => {
    mockGenerateContent.mockResolvedValue(reply(GOOD));

    process.env.GEMINI_BASE_URL = 'https://gemini-proxy.example.uz';
    process.env.GEMINI_API_KEY = 'proxy-test-key';
    GoogleGenAI.mockClear();
    expect((await post(teacherToken)).status).toBe(200);
    expect(GoogleGenAI).toHaveBeenLastCalledWith({
      apiKey: 'proxy-test-key',
      httpOptions: { baseUrl: 'https://gemini-proxy.example.uz' },
    });

    delete process.env.GEMINI_BASE_URL;
    expect((await post(teacherToken)).status).toBe(200);
    expect(GoogleGenAI).toHaveBeenLastCalledWith({ apiKey: 'proxy-test-key' });
  });
});

describe('aiLimiter', () => {
  test("bir foydalanuvchiga 10 daqiqada 5 tadan ortiq so'rov — 429", async () => {
    process.env.AI_LIMITER_ENABLED = 'true';
    mockGenerateContent.mockResolvedValue(reply(GOOD));
    const { token } = await createUser({ role: 'teacher' });

    const statuses = [];
    for (let i = 0; i < 6; i += 1) statuses.push((await post(token)).status);

    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    // Boshqa foydalanuvchiga ta'sir qilmaydi
    expect((await post(teacherToken)).status).toBe(200);
    delete process.env.AI_LIMITER_ENABLED;
  });
});
