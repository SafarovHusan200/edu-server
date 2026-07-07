jest.mock('../src/modules/payment/multicard.service');

const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/app');
const multicardService = require('../src/modules/payment/multicard.service');
const User = require('../src/modules/users/user.model');
const Enrollment = require('../src/modules/enrollment/enrollment.model');
const { createUser, createCategory, createCourse } = require('./helpers');

const buildSign = (invoiceId, amount) => {
  const raw = `${process.env.MULTICARD_STORE_ID}${invoiceId}${amount}${process.env.MULTICARD_SECRET}`;
  return crypto.createHash('md5').update(raw).digest('hex');
};

describe('Payment', () => {
  beforeEach(() => {
    multicardService.createInvoice.mockResolvedValue({
      uuid: 'mock-uuid',
      checkoutUrl: 'https://mock.multicard.uz/checkout/mock-uuid',
    });
  });

  test('wallet to\'lovi muvaffaqiyatli callbackdan keyin balansni oshiradi', async () => {
    const { user, token } = await createUser({ role: 'student' });

    const createRes = await request(app)
      .post('/api/v1/payment/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ purpose: 'wallet', amount: 20000 });

    expect(createRes.status).toBe(201);
    const { invoiceId } = createRes.body.data;

    const sign = buildSign(invoiceId, 20000);

    const callbackRes = await request(app).post('/api/v1/payment/callback').send({
      invoice_id: invoiceId,
      uuid: 'mock-uuid',
      amount: 20000,
      status: 'success',
      sign,
    });

    expect(callbackRes.status).toBe(200);
    expect(callbackRes.body.success).toBe(true);

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.balance).toBe(20000);
  });

  test('noto\'g\'ri sign bilan callback rad etiladi va balans o\'zgarmaydi', async () => {
    const { user, token } = await createUser({ role: 'student' });

    const createRes = await request(app)
      .post('/api/v1/payment/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ purpose: 'wallet', amount: 20000 });

    const { invoiceId } = createRes.body.data;

    const callbackRes = await request(app).post('/api/v1/payment/callback').send({
      invoice_id: invoiceId,
      uuid: 'mock-uuid',
      amount: 20000,
      status: 'success',
      sign: 'notogri-sign',
    });

    expect(callbackRes.status).toBe(400);

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.balance).toBe(0);
  });

  test('bir xil callback ikki marta kelsa balans faqat bir marta oshadi (idempotent)', async () => {
    const { user, token } = await createUser({ role: 'student' });

    const createRes = await request(app)
      .post('/api/v1/payment/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ purpose: 'wallet', amount: 15000 });

    const { invoiceId } = createRes.body.data;
    const sign = buildSign(invoiceId, 15000);
    const payload = { invoice_id: invoiceId, uuid: 'mock-uuid', amount: 15000, status: 'success', sign };

    await request(app).post('/api/v1/payment/callback').send(payload);
    await request(app).post('/api/v1/payment/callback').send(payload);

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.balance).toBe(15000);
  });

  test('boshqa foydalanuvchi to\'lov holatini ko\'ra olmaydi (IDOR himoyasi)', async () => {
    const { token: ownerToken } = await createUser({ role: 'student' });
    const { token: otherToken } = await createUser({ role: 'student' });

    const createRes = await request(app)
      .post('/api/v1/payment/create')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ purpose: 'wallet', amount: 15000 });

    const { invoiceId } = createRes.body.data;

    const ownRes = await request(app)
      .get(`/api/v1/payment/status/${invoiceId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(ownRes.status).toBe(200);

    const otherRes = await request(app)
      .get(`/api/v1/payment/status/${invoiceId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(otherRes.status).toBe(403);
  });

  test('pullik kurs uchun to\'lov muvaffaqiyatli bo\'lgach enrollment avtomatik yaratiladi', async () => {
    const { user: teacher } = await createUser({ role: 'teacher' });
    const { user: student, token: studentToken } = await createUser({ role: 'student' });
    const category = await createCategory();
    const course = await createCourse({
      teacherId: teacher._id,
      categoryId: category._id,
      price: 100000,
    });

    const createRes = await request(app)
      .post('/api/v1/payment/create')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ purpose: 'course', courseId: course._id.toString() });

    expect(createRes.status).toBe(201);
    const { invoiceId } = createRes.body.data;

    const sign = buildSign(invoiceId, 100000);

    await request(app).post('/api/v1/payment/callback').send({
      invoice_id: invoiceId,
      uuid: 'mock-uuid',
      amount: 100000,
      status: 'success',
      sign,
    });

    const enrollment = await Enrollment.findOne({ student: student._id, course: course._id });
    expect(enrollment).not.toBeNull();
    expect(enrollment.status).toBe('active');
  });
});
