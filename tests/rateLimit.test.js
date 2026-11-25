const request = require('supertest');
const app = require('../src/app');
const { createUser } = require('./helpers');

// Test muhitida limiterlar o'chiq — bu yerda env bayroqlar bilan yoqiladi.
// Har bir test o'z IP'sidan keladi (X-Forwarded-For; trust proxy = loopback), shuning uchun
// limiter xotirasi boshqa testlar bilan aralashmaydi.

describe('authLimiter: IP + login bo\'yicha', () => {
  beforeEach(() => {
    process.env.AUTH_LIMITER_ENABLED = 'true';
  });
  afterEach(() => {
    delete process.env.AUTH_LIMITER_ENABLED;
  });

  const login = (ip, phone, password) =>
    request(app).post('/api/v1/auth/login').set('X-Forwarded-For', ip).send({ phone, password });

  test("bitta login'ga 10 ta xato urinishdan keyin 429; shu IP'dan boshqa login ishlaydi", async () => {
    const ip = '198.51.100.40';
    await createUser({ phone: '998901110001', password: 'password123' });
    await createUser({ phone: '998901110002', password: 'password123' });

    for (let i = 0; i < 10; i += 1) {
      expect((await login(ip, '998901110001', 'noto-gri')).status).toBe(401);
    }

    const blocked = await login(ip, '998901110001', 'password123');
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      success: false,
      statusCode: 429,
      message: expect.any(String),
    });

    // Telefon boshqacha yozilsa ham o'sha akkaunt (normalize: faqat raqamlar)
    expect((await login(ip, '+998901110001', 'password123')).status).toBe(429);

    // Sinfdoshi (o'sha IP, boshqa login) bemalol kiradi
    expect((await login(ip, '998901110002', 'password123')).status).toBe(200);
  });

  test('muvaffaqiyatli login\'lar hisoblagichni oshirmaydi', async () => {
    const ip = '198.51.100.41';
    await createUser({ phone: '998901110003', password: 'password123' });

    for (let i = 0; i < 15; i += 1) {
      expect((await login(ip, '998901110003', 'password123')).status).toBe(200);
    }
    // 9 ta xato — hali limitga yetmagan (muvaffaqiyatlilari sanalganda 10+ bo'lardi)
    for (let i = 0; i < 9; i += 1) {
      expect((await login(ip, '998901110003', 'noto-gri')).status).toBe(401);
    }
    expect((await login(ip, '998901110003', 'password123')).status).toBe(200);
  });
});

describe('apiLimiter: X-Internal-Key (SSR)', () => {
  const KEY = 'ssr-test-internal-key-0123456789';

  beforeEach(() => {
    process.env.API_LIMITER_ENABLED = 'true';
    process.env.SSR_INTERNAL_KEY = KEY;
  });
  afterEach(() => {
    delete process.env.API_LIMITER_ENABLED;
    delete process.env.SSR_INTERNAL_KEY;
  });

  // Mavjud bo'lmagan anonim route — 404, lekin limiter undan oldin ishlaydi
  const hit = (ip, key) => {
    const req = request(app).get('/api/v1/__rate-limit-probe').set('X-Forwarded-For', ip);
    return key === undefined ? req : req.set('X-Internal-Key', key);
  };

  test("to'g'ri kalit bilan limitga tushmaydi, noto'g'ri kalit bilan tushadi", async () => {
    const ip = '198.51.100.50';

    // Noto'g'ri / kalitsiz — sanaladi
    const wrong = await hit(ip, 'notogri-kalit');
    expect(wrong.headers['ratelimit-remaining']).toBe('299');
    expect((await hit(ip, KEY.slice(0, -1))).headers['ratelimit-remaining']).toBe('298');
    expect((await hit(ip)).headers['ratelimit-remaining']).toBe('297');

    // To'g'ri kalit — limiter o'tkazib yuboradi (sarlavha yo'q, hisoblagich o'zgarmaydi)
    for (let i = 0; i < 3; i += 1) {
      const ok = await hit(ip, KEY);
      expect(ok.status).not.toBe(429);
      expect(ok.headers['ratelimit-remaining']).toBeUndefined();
    }
    expect((await hit(ip)).headers['ratelimit-remaining']).toBe('296');
  });

  test("300 ta anonim so'rovdan keyin 429, to'g'ri kalit bilan esa o'tadi", async () => {
    const ip = '198.51.100.51';
    for (let i = 0; i < 300; i += 1) await hit(ip, 'notogri');

    const blocked = await hit(ip, 'notogri');
    expect(blocked.status).toBe(429);
    expect(blocked.body.statusCode).toBe(429);

    expect((await hit(ip, KEY)).status).toBe(404);
  });

  test('SSR_INTERNAL_KEY bo\'sh bo\'lsa imtiyoz o\'chiq', async () => {
    delete process.env.SSR_INTERNAL_KEY;
    const res = await hit('198.51.100.52', '');
    expect(res.headers['ratelimit-remaining']).toBe('299');
  });
});
