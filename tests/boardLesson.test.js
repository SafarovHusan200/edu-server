const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');
const { createUser } = require('./helpers');

const URL = '/api/v1/board-lessons';
const IMG = '/uploads/board-lessons/123_456.webp';

const SLIDES = [
  { title: 'Kirish', body: 'Bugun **kasrlar**ni o\'rganamiz', layout: 'text', icon: 'lightbulb' },
  { title: 'Rasm', image: IMG, layout: 'split', theme: 'galaxy' },
  { image: '/uploads/board-lessons/second.png', layout: 'image' },
];
const EXERCISES = [
  { text: '1/2 + 1/2 = ?', options: ['1', '2', '1/4'], correctIndex: 0 },
  { text: "To'g'rimi?", options: ["To'g'ri", "Noto'g'ri"], correctIndex: 1 },
];
const LESSON = { title: 'Kasrlar', subject: 'Matematika', grade: 5, theme: 'sunset', slides: SLIDES, exercises: EXERCISES };

const auth = (req, token) => req.set('Authorization', `Bearer ${token}`);
const create = (token, body = LESSON) => auth(request(app).post(URL), token).send(body);
const fieldsOf = (res) => res.body.errors.map((e) => e.field);

describe('Interaktiv dars (board-lessons)', () => {
  test('student barcha endpointlarda 403 oladi', async () => {
    const { token } = await createUser({ role: 'student' });
    expect((await auth(request(app).get(URL), token)).status).toBe(403);
    expect((await create(token)).status).toBe(403);
  });

  test("token berilmasa 401 qaytadi", async () => {
    expect((await request(app).get(URL)).status).toBe(401);
  });

  test("teacher dars yaratadi, to'liq javobda summary maydonlari va kontent bor", async () => {
    const { user, token } = await createUser({ role: 'teacher' });

    const res = await create(token);
    expect(res.status).toBe(201);
    const { lesson } = res.body.data;
    expect(lesson).toMatchObject({
      title: 'Kasrlar',
      subject: 'Matematika',
      grade: 5,
      theme: 'sunset',
      description: null,
      coverImage: IMG,
      slideCount: 3,
      exerciseCount: 2,
      createdBy: user._id.toString(),
    });
    expect(lesson.slides[0]).toMatchObject({ title: 'Kirish', layout: 'text', icon: 'lightbulb', image: null, theme: null });
    expect(lesson.exercises[1]).toMatchObject({ options: ["To'g'ri", "Noto'g'ri"], correctIndex: 1 });

    const one = await auth(request(app).get(`${URL}/${lesson._id}`), token);
    expect(one.status).toBe(200);
    expect(one.body.data.lesson.slides).toHaveLength(3);
  });

  test("ro'yxatda slideCount/exerciseCount/coverImage to'g'ri, slides/exercises qaytmaydi, meta bor", async () => {
    const { token } = await createUser({ role: 'teacher' });
    await create(token);
    await create(token, { title: 'Faqat mashq', exercises: [EXERCISES[0]] });

    const res = await auth(request(app).get(URL), token);
    expect(res.status).toBe(200);
    const { lessons, meta } = res.body.data;
    expect(meta).toMatchObject({ total: 2, page: 1, totalPages: 1 });

    // updatedAt kamayish bo'yicha — oxirgi yaratilgan birinchi
    expect(lessons[0]).toMatchObject({ title: 'Faqat mashq', slideCount: 0, exerciseCount: 1, coverImage: null });
    expect(lessons[1]).toMatchObject({ title: 'Kasrlar', slideCount: 3, exerciseCount: 2, coverImage: IMG, grade: 5 });
    lessons.forEach((l) => {
      expect(l).not.toHaveProperty('slides');
      expect(l).not.toHaveProperty('exercises');
    });

    const filtered = await auth(request(app).get(URL).query({ search: 'kasr', grade: 5 }), token);
    expect(filtered.body.data.lessons.map((l) => l.title)).toEqual(['Kasrlar']);
  });

  test("teacher boshqa teacher darsini o'qiy/tahrirlay/o'chira/nusxalay olmaydi (403), ro'yxatida ko'rmaydi", async () => {
    const { token: ownerToken } = await createUser({ role: 'teacher' });
    const { token: otherToken } = await createUser({ role: 'teacher' });
    const id = (await create(ownerToken)).body.data.lesson._id;

    expect((await auth(request(app).get(`${URL}/${id}`), otherToken)).status).toBe(403);
    expect((await auth(request(app).patch(`${URL}/${id}`), otherToken).send(LESSON)).status).toBe(403);
    expect((await auth(request(app).delete(`${URL}/${id}`), otherToken)).status).toBe(403);
    expect((await auth(request(app).post(`${URL}/${id}/duplicate`), otherToken)).status).toBe(403);

    // teacher uchun all=true e'tiborga olinmaydi
    const list = await auth(request(app).get(URL).query({ all: 'true' }), otherToken);
    expect(list.body.data.lessons).toHaveLength(0);
  });

  test("admin all=true bilan hammaning darslarini ko'radi, all'siz — faqat o'zinikini", async () => {
    const { token: t1 } = await createUser({ role: 'teacher' });
    const { token: t2 } = await createUser({ role: 'teacher' });
    const { token: adminToken } = await createUser({ role: 'admin' });
    await create(t1);
    await create(t2, { ...LESSON, title: 'Ikkinchi' });

    const all = await auth(request(app).get(URL).query({ all: 'true' }), adminToken);
    expect(all.status).toBe(200);
    expect(all.body.data.meta.total).toBe(2);

    const own = await auth(request(app).get(URL), adminToken);
    expect(own.body.data.meta.total).toBe(0);
  });

  test("egasi PATCH bilan slides/exercises'ni to'liq almashtiradi, DELETE ishlaydi, keyin 404", async () => {
    const { token } = await createUser({ role: 'teacher' });
    const id = (await create(token)).body.data.lesson._id;

    const patched = await auth(request(app).patch(`${URL}/${id}`), token).send({
      title: 'Yangi nom',
      grade: null,
      slides: [{ title: 'Yagona slayd' }],
      exercises: [],
    });
    expect(patched.status).toBe(200);
    expect(patched.body.data.lesson).toMatchObject({ title: 'Yangi nom', grade: null, slideCount: 1, exerciseCount: 0, coverImage: null });

    expect((await auth(request(app).delete(`${URL}/${id}`), token)).status).toBe(200);
    expect((await auth(request(app).get(`${URL}/${id}`), token)).status).toBe(404);
  });

  test("duplicate — yangi mustaqil nusxa, title \"(nusxa)\" bilan, uzun nom qirqiladi", async () => {
    const { token: ownerToken } = await createUser({ role: 'teacher' });
    const { user: admin, token: adminToken } = await createUser({ role: 'admin' });
    const source = (await create(ownerToken)).body.data.lesson;

    const res = await auth(request(app).post(`${URL}/${source._id}/duplicate`), adminToken);
    expect(res.status).toBe(201);
    const copy = res.body.data.lesson;
    expect(copy._id).not.toBe(source._id);
    expect(copy).toMatchObject({ title: 'Kasrlar (nusxa)', createdBy: admin._id.toString(), slideCount: 3, exerciseCount: 2 });
    expect(copy.slides[0]._id).not.toBe(source.slides[0]._id);

    const longTitle = 'A'.repeat(120);
    const longId = (await create(ownerToken, { ...LESSON, title: longTitle })).body.data.lesson._id;
    const longCopy = await auth(request(app).post(`${URL}/${longId}/duplicate`), ownerToken);
    expect(longCopy.status).toBe(201);
    expect(longCopy.body.data.lesson.title).toHaveLength(120);
    expect(longCopy.body.data.lesson.title.endsWith(' (nusxa)')).toBe(true);
  });

  describe('422 validatsiya — field formatlari', () => {
    let token;
    beforeEach(async () => {
      ({ token } = await createUser({ role: 'teacher' }));
    });

    test("title yo'q va bo'sh dars", async () => {
      const res = await create(token, { slides: [], exercises: [] });
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ success: false, statusCode: 422, message: 'Validatsiya xatosi' });
      expect(fieldsOf(res)).toEqual(expect.arrayContaining(['title', 'slides']));
      // bo'sh dars xatosi bir marta chiqadi
      expect(fieldsOf(res).filter((f) => f === 'slides')).toHaveLength(1);
    });

    test("slides va exercises umuman yuborilmasa ham bo'sh dars 422", async () => {
      const res = await create(token, { title: 'Bo\'sh' });
      expect(res.status).toBe(422);
      expect(fieldsOf(res)).toEqual(['slides']);
    });

    test("slayd xatolari slides[i] prefiksi bilan", async () => {
      const res = await create(token, {
        title: 'X',
        slides: [
          { title: 'OK' },
          {},
          { title: 'Split', layout: 'split' },
          { title: 'Tashqi', image: 'https://evil.com/a.png' },
          { body: '![a](data:image/png;base64,AAAA)' },
          { title: 'Y', icon: 'dragon', theme: 'pink', layout: 'grid' },
        ],
      });
      expect(res.status).toBe(422);
      expect(fieldsOf(res)).toEqual(
        expect.arrayContaining([
          'slides[1]',
          'slides[2].image',
          'slides[3].image',
          'slides[4].body',
          'slides[5].icon',
          'slides[5].theme',
          'slides[5].layout',
        ])
      );
      expect(fieldsOf(res).some((f) => f.startsWith('slides[0]'))).toBe(false);
      const base64 = res.body.errors.find((e) => e.field === 'slides[4].body');
      expect(base64.message).toMatch(/Base64/);
    });

    test("mashq xatolari exercises[i] prefiksi bilan", async () => {
      const res = await create(token, {
        title: 'X',
        exercises: [
          { text: 'OK', options: ['a', 'b'], correctIndex: 1 },
          { text: 'Bitta variant', options: ['a'], correctIndex: 0 },
          { text: 'Index katta', options: ['a', 'b'], correctIndex: 2 },
          { text: '', options: ['a', ' '], correctIndex: 0 },
          { text: '![1](/uploads/board-lessons/1.png)![2](/uploads/board-lessons/2.png)![3](/uploads/board-lessons/3.png)![4](/uploads/board-lessons/4.png)', options: ['a', 'b'], correctIndex: 0 },
        ],
      });
      expect(res.status).toBe(422);
      expect(fieldsOf(res)).toEqual(
        expect.arrayContaining([
          'exercises[1].options',
          'exercises[2].correctIndex',
          'exercises[3].text',
          'exercises[3].options',
          'exercises[4].text',
        ])
      );
      expect(fieldsOf(res).some((f) => f.startsWith('exercises[0]'))).toBe(false);
    });

    test("grade/theme noto'g'ri, 50 tadan ko'p slayd", async () => {
      const res = await create(token, {
        title: 'X',
        grade: 12,
        theme: 'pink',
        slides: Array.from({ length: 51 }, (_, i) => ({ title: `S${i}` })),
      });
      expect(res.status).toBe(422);
      expect(fieldsOf(res)).toEqual(expect.arrayContaining(['grade', 'theme', 'slides']));
    });
  });

  test('upload-image rasmni /uploads/board-lessons ga saqlaydi', async () => {
    const { token } = await createUser({ role: 'teacher' });
    // 1x1 PNG
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64'
    );

    const res = await auth(request(app).post(`${URL}/upload-image`), token).attach('image', png, {
      filename: 'a.png',
      contentType: 'image/png',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.image).toMatch(/^\/uploads\/board-lessons\/.+\.png$/);

    fs.rmSync(path.join(__dirname, '..', res.body.data.image), { force: true });
  });
});
