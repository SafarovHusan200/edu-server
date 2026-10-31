jest.mock('../src/modules/payment/multicard.service');

const request = require('supertest');
const app = require('../src/app');
const multicardService = require('../src/modules/payment/multicard.service');
const Lesson = require('../src/modules/lessons/lesson.model');
const Enrollment = require('../src/modules/enrollment/enrollment.model');
const PromoCode = require('../src/modules/promocodes/promocode.model');
const { createUser, createCategory, createCourse } = require('./helpers');

describe('Lessons — access control', () => {
  test('GET /lessons/:id — tokensiz pullik kursning darsi locked qaytadi, course maydoni bor', async () => {
    const { user: teacher } = await createUser({ role: 'teacher' });
    const category = await createCategory();
    const course = await createCourse({
      teacherId: teacher._id,
      categoryId: category._id,
      price: 50000,
      isPublished: true,
    });
    const lesson = await Lesson.create({ course: course._id, title: 'Kirish darsi', order: 0, content: 'maxfiy' });

    const res = await request(app).get(`/api/v1/lessons/${lesson._id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.lesson).toMatchObject({
      _id: lesson._id.toString(),
      title: 'Kirish darsi',
      order: 0,
      locked: true,
      course: course._id.toString(),
    });
    expect(res.body.data.lesson.content).toBeUndefined();
  });

  test('GET /lessons/:id — kursga yozilgan student token bilan so\'rasa to\'liq dars qaytadi (locked bo\'lmaydi)', async () => {
    const { user: teacher } = await createUser({ role: 'teacher' });
    const { user: student, token: studentToken } = await createUser({ role: 'student' });
    const category = await createCategory();
    const course = await createCourse({
      teacherId: teacher._id,
      categoryId: category._id,
      price: 50000,
      isPublished: true,
    });
    const lesson = await Lesson.create({ course: course._id, title: 'Kirish darsi', order: 0, content: 'maxfiy matn' });
    await Enrollment.create({ student: student._id, course: course._id, status: 'active' });

    const res = await request(app)
      .get(`/api/v1/lessons/${lesson._id}`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.lesson.locked).toBeUndefined();
    expect(res.body.data.lesson.content).toBe('maxfiy matn');
  });

  test('GET /lessons/:id — yozilmagan student token bilan so\'rasa ham locked qaytadi', async () => {
    const { user: teacher } = await createUser({ role: 'teacher' });
    const { token: studentToken } = await createUser({ role: 'student' });
    const category = await createCategory();
    const course = await createCourse({
      teacherId: teacher._id,
      categoryId: category._id,
      price: 50000,
      isPublished: true,
    });
    const lesson = await Lesson.create({ course: course._id, title: 'Kirish darsi', order: 0, content: 'maxfiy' });

    const res = await request(app)
      .get(`/api/v1/lessons/${lesson._id}`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.lesson.locked).toBe(true);
  });

  test('GET /courses/:id/lessons — kursga yozilgan student token bilan to\'liq ro\'yxat qaytadi', async () => {
    const { user: teacher } = await createUser({ role: 'teacher' });
    const { user: student, token: studentToken } = await createUser({ role: 'student' });
    const category = await createCategory();
    const course = await createCourse({
      teacherId: teacher._id,
      categoryId: category._id,
      price: 50000,
      isPublished: true,
    });
    await Lesson.create({ course: course._id, title: 'Dars 1', order: 0, content: 'A' });
    await Enrollment.create({ student: student._id, course: course._id, status: 'active' });

    const res = await request(app)
      .get(`/api/v1/courses/${course._id}/lessons`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.lessons[0].locked).toBeUndefined();
    expect(res.body.data.lessons[0].content).toBe('A');
  });

  test('GET /courses/:id/lessons — tokensiz locked ro\'yxat, har birida course maydoni bor', async () => {
    const { user: teacher } = await createUser({ role: 'teacher' });
    const category = await createCategory();
    const course = await createCourse({
      teacherId: teacher._id,
      categoryId: category._id,
      price: 50000,
      isPublished: true,
    });
    await Lesson.create({ course: course._id, title: 'Dars 1', order: 0, content: 'A' });

    const res = await request(app).get(`/api/v1/courses/${course._id}/lessons`);

    expect(res.status).toBe(200);
    expect(res.body.data.lessons[0]).toMatchObject({ locked: true, course: course._id.toString() });
  });

  test('100% chegirmali promokod bilan kurs sotib olingandan keyin darslar locked bo\'lmaydi (end-to-end)', async () => {
    const { user: teacher } = await createUser({ role: 'teacher' });
    const { token: studentToken } = await createUser({ role: 'student' });
    const category = await createCategory();
    const course = await createCourse({
      teacherId: teacher._id,
      categoryId: category._id,
      price: 50000,
      isPublished: true,
    });
    const lesson = await Lesson.create({ course: course._id, title: 'Kirish darsi', order: 0, content: 'maxfiy' });

    await PromoCode.create({ code: 'FULL100', discountPercent: 100 });

    const buyRes = await request(app)
      .post('/api/v1/payment/create')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ purpose: 'course', courseId: course._id.toString(), promoCode: 'FULL100' });

    expect(buyRes.status).toBe(201);
    expect(buyRes.body.data.paidWithBalance).toBe(true);

    const lessonRes = await request(app)
      .get(`/api/v1/lessons/${lesson._id}`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(lessonRes.status).toBe(200);
    expect(lessonRes.body.data.lesson.locked).toBeUndefined();
    expect(lessonRes.body.data.lesson.content).toBe('maxfiy');
  });
});

describe('POST /lessons/:id/video', () => {
  test('video yuklanganda attachments\'ga emas, videoUrl\'ga saqlanadi; durationMinutes ham qo\'shiladi', async () => {
    const { user: teacher, token: teacherToken } = await createUser({ role: 'teacher' });
    const category = await createCategory();
    const course = await createCourse({
      teacherId: teacher._id,
      categoryId: category._id,
      price: 50000,
      isPublished: true,
    });
    const lesson = await Lesson.create({ course: course._id, title: 'Kirish darsi', order: 0 });

    const res = await request(app)
      .post(`/api/v1/lessons/${lesson._id}/video`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .field('durationMinutes', '14')
      .attach('video', Buffer.from('fake mp4 bytes'), { filename: 'kirish.mp4', contentType: 'video/mp4' });

    expect(res.status).toBe(200);
    expect(res.body.data.lesson.videoUrl).toMatch(/^\/uploads\/lessons\/.+\.mp4$/);
    expect(res.body.data.lesson.durationMinutes).toBe(14);
    expect(res.body.data.lesson.attachments).toEqual([]);
  });

  test('boshqa o\'qituvchi video yuklay olmaydi (403)', async () => {
    const { user: teacher } = await createUser({ role: 'teacher' });
    const { token: otherTeacherToken } = await createUser({ role: 'teacher' });
    const category = await createCategory();
    const course = await createCourse({
      teacherId: teacher._id,
      categoryId: category._id,
      price: 50000,
      isPublished: true,
    });
    const lesson = await Lesson.create({ course: course._id, title: 'Kirish darsi', order: 0 });

    const res = await request(app)
      .post(`/api/v1/lessons/${lesson._id}/video`)
      .set('Authorization', `Bearer ${otherTeacherToken}`)
      .attach('video', Buffer.from('fake mp4 bytes'), { filename: 'kirish.mp4', contentType: 'video/mp4' });

    expect(res.status).toBe(403);
  });

  test('pdf fayl video sifatida rad etiladi', async () => {
    const { user: teacher, token: teacherToken } = await createUser({ role: 'teacher' });
    const category = await createCategory();
    const course = await createCourse({
      teacherId: teacher._id,
      categoryId: category._id,
      price: 50000,
      isPublished: true,
    });
    const lesson = await Lesson.create({ course: course._id, title: 'Kirish darsi', order: 0 });

    const res = await request(app)
      .post(`/api/v1/lessons/${lesson._id}/video`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .attach('video', Buffer.from('%PDF-1.4'), { filename: 'hujjat.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
  });
});
