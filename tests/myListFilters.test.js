// "Kitoblarim" (GET /books?uploadedBy=...) va "Testlarim" (GET /quizzes/my?search=&isActive=)
// filtrlari — frontend ro'yxatni o'zi ajratmasligi uchun backend'da filtrlash
const request = require('supertest');
const app = require('../src/app');
const Book = require('../src/modules/books/book.model');
const BookCategory = require('../src/modules/book-categories/bookCategory.model');
const Quiz = require('../src/modules/quizzes/quiz.model');
const { createUser } = require('./helpers');

const get = (url, token) => {
  const req = request(app).get(url);
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

describe('GET /books?uploadedBy', () => {
  const setup = async () => {
    const { user: teacher, token } = await createUser({ role: 'teacher' });
    const { user: other, token: otherToken } = await createUser({ role: 'teacher' });
    const category = await BookCategory.create({ name: 'Adabiyot', slug: `adabiyot-${Date.now()}-${Math.random()}` });
    const base = { author: 'Muallif', category: category._id };
    await Book.create([
      { ...base, title: 'Mening nashrim', uploadedBy: teacher._id, isPublished: true },
      { ...base, title: 'Mening draftim', uploadedBy: teacher._id, isPublished: false },
      { ...base, title: 'Begona nashr', uploadedBy: other._id, isPublished: true },
      { ...base, title: 'Begona draft', uploadedBy: other._id, isPublished: false },
    ]);
    return { teacher, token, other, otherToken };
  };

  const titles = (res) => res.body.data.books.map((b) => b.title).sort();

  test("uploadedBy=me — faqat o'zining kitoblari, draftlar bilan", async () => {
    const { token } = await setup();
    const res = await get('/api/v1/books?uploadedBy=me', token);
    expect(res.status).toBe(200);
    expect(titles(res)).toEqual(['Mening draftim', 'Mening nashrim']);
    expect(res.body.data.meta.total).toBe(2);
  });

  test("uploadedBy=<boshqa o'qituvchi id> — uning faqat nashr qilingan kitoblari", async () => {
    const { token, other } = await setup();
    const res = await get(`/api/v1/books?uploadedBy=${other._id}`, token);
    expect(res.status).toBe(200);
    expect(titles(res)).toEqual(['Begona nashr']);
  });

  test("search — regex belgilari oddiy matn sifatida izlanadi (500 emas)", async () => {
    const { token } = await setup();
    const paren = await get(`/api/v1/books?search=${encodeURIComponent('(')}`, token);
    expect(paren.status).toBe(200);
    expect(paren.body.data.books).toHaveLength(0);

    const dot = await get(`/api/v1/books?search=${encodeURIComponent('.*')}`, token);
    expect(dot.status).toBe(200);
    expect(dot.body.data.books).toHaveLength(0);

    const normal = await get('/api/v1/books?search=nashr&uploadedBy=me', token);
    expect(titles(normal)).toEqual(['Mening nashrim']);
  });

  test("uploadedBy=me tokensiz — 401, noto'g'ri id — 400", async () => {
    await setup();
    expect((await get('/api/v1/books?uploadedBy=me')).status).toBe(401);
    expect((await get('/api/v1/books?uploadedBy=abc')).status).toBe(400);
  });
});

describe('GET /quizzes/my?search&isActive', () => {
  const grades = [{ number: 5, letter: 'A' }];

  const setup = async () => {
    const { user: teacher, token } = await createUser({ role: 'teacher' });
    const { user: other } = await createUser({ role: 'teacher' });
    const base = { targetType: 'standalone', timeLimit: 20, targetGrades: grades };
    await Quiz.create([
      { ...base, title: 'Algebra (1-bob)', createdBy: teacher._id, isActive: true },
      { ...base, title: 'Geometriya takrori', createdBy: teacher._id, isActive: false },
      { ...base, title: 'Algebra begona', createdBy: other._id, isActive: true },
    ]);
    return { token };
  };

  const titles = (res) => res.body.data.quizzes.map((q) => q.title).sort();

  test("search — nom bo'yicha, regex belgilari xavfsiz", async () => {
    const { token } = await setup();
    const res = await get('/api/v1/quizzes/my?search=algebra', token);
    expect(res.status).toBe(200);
    expect(titles(res)).toEqual(['Algebra (1-bob)']);

    const paren = await get(`/api/v1/quizzes/my?search=${encodeURIComponent('(1-bob')}`, token);
    expect(paren.status).toBe(200);
    expect(titles(paren)).toEqual(['Algebra (1-bob)']);
  });

  test('isActive=true/false — holat bo\'yicha', async () => {
    const { token } = await setup();
    expect(titles(await get('/api/v1/quizzes/my?isActive=true', token))).toEqual(['Algebra (1-bob)']);
    expect(titles(await get('/api/v1/quizzes/my?isActive=false', token))).toEqual(['Geometriya takrori']);
    expect(titles(await get('/api/v1/quizzes/my', token))).toHaveLength(2);
  });
});
