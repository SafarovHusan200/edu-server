const request = require('supertest');
const app = require('../src/app');
const User = require('../src/modules/users/user.model');
const Otp = require('../src/modules/auth/otp.model');
const { issueLoginOtp, LINK_TOKEN_PATTERN } = require('../src/modules/auth/otp.service');

const createTelegramUser = (telegramId) =>
  User.create({
    name: 'Telegram foydalanuvchi',
    phone: `99890${telegramId}`.slice(0, 12),
    role: 'student',
    grade: { number: 5, letter: 'A' },
    telegramId,
    isVerified: true,
  });

const login = (code) => request(app).post('/api/v1/auth/telegram').send({ code });

describe('Telegram OTP (kuchaytirilgan)', () => {
  afterEach(() => {
    delete process.env.OTP_LIMITER_ENABLED;
  });

  test('kod va havola tokeni yaratiladi; eski kodlar bekor qilinadi', async () => {
    const first = await issueLoginOtp(111);
    const second = await issueLoginOtp(111);

    expect(second.code).toMatch(/^\d{6}$/);
    expect(second.linkToken).toMatch(LINK_TOKEN_PATTERN);
    expect(second.linkToken).not.toBe(second.code);
    expect(await Otp.countDocuments({ telegramId: 111 })).toBe(1);
    expect(await Otp.exists({ code: first.code, telegramId: 111, linkToken: first.linkToken })).toBeNull();
  });

  test('qo\'lda kiritilgan 6 xonali kod bilan kiriladi, ikkinchi marta ishlamaydi', async () => {
    const user = await createTelegramUser(222);
    const { code } = await issueLoginOtp(user.telegramId);

    const ok = await login(code);
    expect(ok.status).toBe(200);
    expect(ok.body.data.user._id).toBe(user._id.toString());

    expect((await login(code)).status).toBe(400);
  });

  test('havoladagi uzun token bilan kiriladi; token va kod bitta yozuv — biri ishlatilsa ikkinchisi ham yopiladi', async () => {
    const user = await createTelegramUser(333);
    const { code, linkToken } = await issueLoginOtp(user.telegramId);

    expect((await login(linkToken)).status).toBe(200);
    expect((await login(code)).status).toBe(400);
  });

  test('bir xil kod bilan parallel ikki so\'rovdan faqat bittasi kiradi', async () => {
    const user = await createTelegramUser(444);
    const { code } = await issueLoginOtp(user.telegramId);

    const statuses = (await Promise.all([login(code), login(code)])).map((r) => r.status).sort();
    expect(statuses).toEqual([200, 400]);
  });

  test("noto'g'ri formatdagi kod (obyekt, qisqa, harfli) — 422", async () => {
    for (const code of [{ $ne: '1' }, '12345', 'abcdef', 'x'.repeat(31)]) {
      const res = await login(code);
      expect(res.status).toBe(422);
    }
  });

  test("ketma-ket 5 ta noto'g'ri urinishdan keyin 429; to'g'ri kirish hisobga kirmaydi", async () => {
    process.env.OTP_LIMITER_ENABLED = 'true';
    const user = await createTelegramUser(555);

    // Bu testning o'z IP'si bo'lishi uchun (boshqa testlarning urinishlari aralashmasin)
    const ip = '198.51.100.23';
    const attempt = (code) =>
      request(app).post('/api/v1/auth/telegram').set('X-Forwarded-For', ip).send({ code });

    const { code } = await issueLoginOtp(user.telegramId);
    expect((await attempt(code)).status).toBe(200); // muvaffaqiyatli — sanalmaydi

    for (let i = 0; i < 5; i += 1) {
      expect((await attempt('000000')).status).toBe(400);
    }
    const blocked = await attempt('000000');
    expect(blocked.status).toBe(429);
  });
});
