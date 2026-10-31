const request = require('supertest');
const app = require('../src/app');
const Enrollment = require('../src/modules/enrollment/enrollment.model');
const Quiz = require('../src/modules/quizzes/quiz.model');
const { createUser, createCategory } = require('./helpers');

describe('Courses', () => {
  test('teacher kurs yaratishi mumkin, student esa mumkin emas', async () => {
    const { token: teacherToken } = await createUser({ role: 'teacher' });
    const { token: studentToken } = await createUser({ role: 'student' });
    const category = await createCategory();

    const teacherRes = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'JavaScript asoslari', description: 'desc', category: category._id.toString() });

    expect(teacherRes.status).toBe(201);
    expect(teacherRes.body.data.course.isPublished).toBe(false);

    const studentRes = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ title: 'Boshqa kurs', description: 'desc', category: category._id.toString() });

    expect(studentRes.status).toBe(403);
  });

  test('faqat isPublished=true kurslar ochiq ro\'yxatda ko\'rinadi', async () => {
    const { token: teacherToken, user: teacher } = await createUser({ role: 'teacher' });
    const category = await createCategory();

    const createRes = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Chop etilmagan kurs', category: category._id.toString() });

    const courseId = createRes.body.data.course._id;

    const listRes = await request(app).get('/api/v1/courses');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.courses.find((c) => c._id === courseId)).toBeUndefined();

    await request(app)
      .patch(`/api/v1/courses/${courseId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ isPublished: true });

    const listRes2 = await request(app).get('/api/v1/courses');
    expect(listRes2.body.data.courses.find((c) => c._id === courseId)).toBeDefined();
  });

  test('boshqa teacher kursni tahrirlay olmaydi', async () => {
    const { token: ownerToken } = await createUser({ role: 'teacher' });
    const { token: otherTeacherToken } = await createUser({ role: 'teacher' });
    const category = await createCategory();

    const createRes = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Kurs', category: category._id.toString() });

    const courseId = createRes.body.data.course._id;

    const updateRes = await request(app)
      .patch(`/api/v1/courses/${courseId}`)
      .set('Authorization', `Bearer ${otherTeacherToken}`)
      .send({ title: 'Yangi nom' });

    expect(updateRes.status).toBe(403);
  });

  test('isFree filtri va price_asc/price_desc saralash to\'g\'ri ishlaydi', async () => {
    const { token: teacherToken } = await createUser({ role: 'teacher' });
    const category = await createCategory();

    const makeCourse = async (title, price) => {
      const res = await request(app)
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title, category: category._id.toString(), price });
      await request(app)
        .patch(`/api/v1/courses/${res.body.data.course._id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ isPublished: true });
      return res.body.data.course._id;
    };

    const freeId = await makeCourse('Bepul kurs', 0);
    const cheapId = await makeCourse('Arzon kurs', 10000);
    const expensiveId = await makeCourse('Qimmat kurs', 90000);

    const freeRes = await request(app).get('/api/v1/courses').query({ isFree: true, category: category._id.toString() });
    const freeIds = freeRes.body.data.courses.map((c) => c._id);
    expect(freeIds).toContain(freeId);
    expect(freeIds).not.toContain(cheapId);

    const paidRes = await request(app).get('/api/v1/courses').query({ isFree: false, category: category._id.toString() });
    const paidIds = paidRes.body.data.courses.map((c) => c._id);
    expect(paidIds).not.toContain(freeId);
    expect(paidIds).toContain(cheapId);

    const ascRes = await request(app)
      .get('/api/v1/courses')
      .query({ sort: 'price_asc', category: category._id.toString() });
    const ascPrices = ascRes.body.data.courses.map((c) => c.price);
    expect(ascPrices).toEqual([...ascPrices].sort((a, b) => a - b));

    const descRes = await request(app)
      .get('/api/v1/courses')
      .query({ sort: 'price_desc', category: category._id.toString() });
    expect(descRes.body.data.courses[0]._id).toBe(expensiveId);
  });

  test('sort=popular yozilganlar soniga qarab saralaydi', async () => {
    const { token: teacherToken } = await createUser({ role: 'teacher' });
    const category = await createCategory();

    const createPublished = async (title) => {
      const res = await request(app)
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title, category: category._id.toString() });
      const id = res.body.data.course._id;
      await request(app)
        .patch(`/api/v1/courses/${id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ isPublished: true });
      return id;
    };

    const popularId = await createPublished('Mashhur kurs');
    const unpopularId = await createPublished('Kamroq mashhur kurs');

    const { user: s1 } = await createUser({ role: 'student' });
    const { user: s2 } = await createUser({ role: 'student' });
    await Enrollment.create({ student: s1._id, course: popularId });
    await Enrollment.create({ student: s2._id, course: popularId });

    const res = await request(app)
      .get('/api/v1/courses')
      .query({ sort: 'popular', category: category._id.toString() });

    const ids = res.body.data.courses.map((c) => c._id);
    expect(ids.indexOf(popularId)).toBeLessThan(ids.indexOf(unpopularId));
  });

  test('excludeEnrolled=true — studentning yozilgan kurslari natijadan chiqariladi, sahifalash DBda to\'g\'ri hisoblanadi', async () => {
    const { token: teacherToken } = await createUser({ role: 'teacher' });
    const { user: student, token: studentToken } = await createUser({ role: 'student' });
    const category = await createCategory();

    const createPublished = async (title) => {
      const res = await request(app)
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title, category: category._id.toString() });
      const id = res.body.data.course._id;
      await request(app)
        .patch(`/api/v1/courses/${id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ isPublished: true });
      return id;
    };

    const allIds = [];
    for (let i = 0; i < 20; i += 1) {
      allIds.push(await createPublished(`Kurs ${i}`));
    }

    const enrolledIds = allIds.slice(0, 3);
    await Promise.all(enrolledIds.map((courseId) => Enrollment.create({ student: student._id, course: courseId })));

    const res = await request(app)
      .get('/api/v1/courses')
      .set('Authorization', `Bearer ${studentToken}`)
      .query({ excludeEnrolled: true, limit: 12, page: 1, category: category._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.data.courses).toHaveLength(12);
    expect(res.body.data.meta).toMatchObject({ total: 17, page: 1, limit: 12, totalPages: 2 });

    const returnedIds = res.body.data.courses.map((c) => c._id);
    for (const enrolledId of enrolledIds) {
      expect(returnedIds).not.toContain(enrolledId);
    }

    // Token bo'lmasa yoki student bo'lmasa — e'tiborsiz qoldiriladi, xato qaytmaydi
    const anonRes = await request(app)
      .get('/api/v1/courses')
      .query({ excludeEnrolled: true, category: category._id.toString(), limit: 50 });
    expect(anonRes.status).toBe(200);
    expect(anonRes.body.data.meta.total).toBe(20);

    const teacherRes = await request(app)
      .get('/api/v1/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .query({ excludeEnrolled: true, category: category._id.toString(), limit: 50 });
    expect(teacherRes.status).toBe(200);
    expect(teacherRes.body.data.meta.total).toBe(20);
  });

  test('GET /courses ro\'yxatidagi har bir kurs lessonsCount va studentsCount qaytaradi', async () => {
    const { token: teacherToken } = await createUser({ role: 'teacher' });
    const { token: studentToken } = await createUser({ role: 'student' });
    const category = await createCategory();

    const createRes = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Darslar soni kursi', category: category._id.toString() });
    const courseId = createRes.body.data.course._id;

    await request(app)
      .patch(`/api/v1/courses/${courseId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ isPublished: true });

    await request(app)
      .post(`/api/v1/courses/${courseId}/lessons`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Birinchi dars' });
    await request(app)
      .post(`/api/v1/courses/${courseId}/lessons`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Ikkinchi dars' });

    await request(app)
      .post('/api/v1/enrollment')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId });

    const res = await request(app)
      .get('/api/v1/courses')
      .query({ category: category._id.toString() });

    const course = res.body.data.courses.find((c) => c._id === courseId);
    expect(course.lessonsCount).toBe(2);
    expect(course.studentsCount).toBe(1);

    const detailRes = await request(app).get(`/api/v1/courses/${courseId}`);
    expect(detailRes.body.data.course.lessonsCount).toBe(2);
    expect(detailRes.body.data.course.studentsCount).toBe(1);
  });

  test('GET /courses/:id — quizzesCount shu kursga tegishli testlar sonini beradi', async () => {
    const { user: teacher, token: teacherToken } = await createUser({ role: 'teacher' });
    const category = await createCategory();

    const createRes = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Test soni kursi', category: category._id.toString() });
    const courseId = createRes.body.data.course._id;

    await Quiz.create({
      title: 'Kurs testi',
      targetType: 'course',
      targetId: courseId,
      createdBy: teacher._id,
      timeLimit: 20,
      targetGrades: [{ number: 5, letter: null }],
    });

    const res = await request(app)
      .get(`/api/v1/courses/${courseId}`)
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.quizzesCount).toBe(1);
  });

  test('darslarni reorder qilish va durationMinutes saqlanishi', async () => {
    const { token: teacherToken } = await createUser({ role: 'teacher' });
    const { token: otherTeacherToken } = await createUser({ role: 'teacher' });
    const category = await createCategory();

    const createRes = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Reorder kursi', category: category._id.toString() });
    const courseId = createRes.body.data.course._id;

    const lesson1Res = await request(app)
      .post(`/api/v1/courses/${courseId}/lessons`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Birinchi dars', durationMinutes: 14 });
    expect(lesson1Res.body.data.lesson.durationMinutes).toBe(14);

    const lesson2Res = await request(app)
      .post(`/api/v1/courses/${courseId}/lessons`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Ikkinchi dars' });

    const lesson1Id = lesson1Res.body.data.lesson._id;
    const lesson2Id = lesson2Res.body.data.lesson._id;

    const reorderRes = await request(app)
      .patch(`/api/v1/courses/${courseId}/lessons/reorder`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ lessonIds: [lesson2Id, lesson1Id] });

    expect(reorderRes.status).toBe(200);
    expect(reorderRes.body.data.lessons.map((l) => l._id)).toEqual([lesson2Id, lesson1Id]);

    const incompleteRes = await request(app)
      .patch(`/api/v1/courses/${courseId}/lessons/reorder`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ lessonIds: [lesson1Id] });
    expect(incompleteRes.status).toBe(400);

    const forbiddenRes = await request(app)
      .patch(`/api/v1/courses/${courseId}/lessons/reorder`)
      .set('Authorization', `Bearer ${otherTeacherToken}`)
      .send({ lessonIds: [lesson1Id, lesson2Id] });
    expect(forbiddenRes.status).toBe(403);
  });
});
