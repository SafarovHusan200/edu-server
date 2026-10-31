jest.mock('../src/modules/payment/multicard.service');

const request = require('supertest');
const app = require('../src/app');
const multicardService = require('../src/modules/payment/multicard.service');
const { createUser, createCategory, createCourse } = require('./helpers');

describe('Enrollment', () => {
  beforeEach(() => {
    multicardService.createInvoice.mockResolvedValue({
      uuid: 'mock-uuid',
      checkoutUrl: 'https://mock.multicard.uz/checkout/mock-uuid',
    });
  });

  test('bepul kursga student darhol enroll bo\'ladi', async () => {
    const { token: teacherToken, user: teacher } = await createUser({ role: 'teacher' });
    const { token: studentToken } = await createUser({ role: 'student' });
    const category = await createCategory();
    const course = await createCourse({ teacherId: teacher._id, categoryId: category._id, price: 0 });

    const res = await request(app)
      .post('/api/v1/enrollment')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId: course._id.toString() });

    expect(res.status).toBe(201);
    expect(res.body.data.enrollment.status).toBe('active');
  });

  test('bir xil kursga ikkinchi marta enroll bo\'lib bo\'lmaydi', async () => {
    const { user: teacher } = await createUser({ role: 'teacher' });
    const { token: studentToken } = await createUser({ role: 'student' });
    const category = await createCategory();
    const course = await createCourse({ teacherId: teacher._id, categoryId: category._id, price: 0 });

    await request(app)
      .post('/api/v1/enrollment')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId: course._id.toString() });

    const res = await request(app)
      .post('/api/v1/enrollment')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId: course._id.toString() });

    expect(res.status).toBe(400);
  });

  test('pullik kursga enroll bo\'lish checkoutUrl qaytaradi va enrollment hali yaratilmaydi', async () => {
    const { user: teacher } = await createUser({ role: 'teacher' });
    const { token: studentToken } = await createUser({ role: 'student' });
    const category = await createCategory();
    const course = await createCourse({
      teacherId: teacher._id,
      categoryId: category._id,
      price: 50000,
    });

    const res = await request(app)
      .post('/api/v1/enrollment')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId: course._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.data.checkoutUrl).toBe('https://mock.multicard.uz/checkout/mock-uuid');
    expect(res.body.data.invoiceId).toBeDefined();
    expect(multicardService.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50000 })
    );
  });

  test('darslarni tugatish Enrollment.progress\'ni to\'g\'ri hisoblaydi', async () => {
    const { user: teacher, token: teacherToken } = await createUser({ role: 'teacher' });
    const { token: studentToken } = await createUser({ role: 'student' });
    const category = await createCategory();
    const course = await createCourse({ teacherId: teacher._id, categoryId: category._id, price: 0 });

    const lesson1Res = await request(app)
      .post(`/api/v1/courses/${course._id}/lessons`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Birinchi dars' });
    const lesson2Res = await request(app)
      .post(`/api/v1/courses/${course._id}/lessons`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Ikkinchi dars' });

    const lesson1Id = lesson1Res.body.data.lesson._id;
    const lesson2Id = lesson2Res.body.data.lesson._id;

    const complete1 = await request(app)
      .post(`/api/v1/lessons/${lesson1Id}/complete`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(complete1.status).toBe(200);

    const myRes1 = await request(app)
      .get('/api/v1/enrollment/my')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(myRes1.body.data.enrollments[0].progress).toBe(50);

    await request(app)
      .post(`/api/v1/lessons/${lesson2Id}/complete`)
      .set('Authorization', `Bearer ${studentToken}`);

    const myRes2 = await request(app)
      .get('/api/v1/enrollment/my')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(myRes2.body.data.enrollments[0].progress).toBe(100);
    expect(myRes2.body.data.enrollments[0].status).toBe('completed');
  });

  test('GET /enrollment/my har bir course uchun lessonsCount qaytaradi', async () => {
    const { user: teacher, token: teacherToken } = await createUser({ role: 'teacher' });
    const { token: studentToken } = await createUser({ role: 'student' });
    const category = await createCategory();
    const course = await createCourse({ teacherId: teacher._id, categoryId: category._id, price: 0 });

    await request(app)
      .post(`/api/v1/courses/${course._id}/lessons`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Birinchi dars' });
    await request(app)
      .post(`/api/v1/courses/${course._id}/lessons`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Ikkinchi dars' });

    await request(app)
      .post('/api/v1/enrollment')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId: course._id.toString() });

    const res = await request(app)
      .get('/api/v1/enrollment/my')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.enrollments[0].course.lessonsCount).toBe(2);
  });
});
