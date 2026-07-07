const request = require('supertest');
const app = require('../src/app');
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
});
