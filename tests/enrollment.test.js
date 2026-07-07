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
});
