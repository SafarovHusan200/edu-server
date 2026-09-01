jest.mock('../src/modules/payment/multicard.service');

const request = require('supertest');
const app = require('../src/app');
const multicardService = require('../src/modules/payment/multicard.service');
const User = require('../src/modules/users/user.model');
const PromoCode = require('../src/modules/promocodes/promocode.model');
const { createUser, createCategory, createCourse } = require('./helpers');

const buildSign = (invoiceId, amount) => {
  const crypto = require('crypto');
  const raw = `${process.env.MULTICARD_STORE_ID}${invoiceId}${amount}${process.env.MULTICARD_SECRET}`;
  return crypto.createHash('md5').update(raw).digest('hex');
};

describe('Promo codes', () => {
  beforeEach(() => {
    multicardService.createInvoice.mockResolvedValue({
      uuid: 'mock-uuid',
      checkoutUrl: 'https://mock.multicard.uz/checkout/mock-uuid',
    });
  });

  test('admin promokod yaratadi, student boshqasi 403 oladi', async () => {
    const { token: adminToken } = await createUser({ role: 'admin' });
    const { token: studentToken } = await createUser({ role: 'student' });

    const adminRes = await request(app)
      .post('/api/v1/promo-codes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'YOZGI30', discountPercent: 30 });
    expect(adminRes.status).toBe(201);

    const studentRes = await request(app)
      .post('/api/v1/promo-codes')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ code: 'BOSHQA10', discountPercent: 10 });
    expect(studentRes.status).toBe(403);
  });

  test('promokod faqat premium sotib olishda ishlaydi — course bilan yuborilsa rad etiladi', async () => {
    const { user: teacher } = await createUser({ role: 'teacher' });
    const { token: studentToken } = await createUser({ role: 'student' });
    const category = await createCategory();
    const course = await createCourse({
      teacherId: teacher._id,
      categoryId: category._id,
      price: 100000,
    });

    await PromoCode.create({ code: 'YOZGI30', discountPercent: 30 });

    const res = await request(app)
      .post('/api/v1/payment/create')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ purpose: 'course', courseId: course._id.toString(), promoCode: 'yozgi30' });

    expect(res.status).toBe(422);
  });

  test('promokod premium sotib olishda summani to\'g\'ri chegirmalaydi, muvaffaqiyatli to\'lovdan keyin tarif premium bo\'ladi', async () => {
    const { user: student, token: studentToken } = await createUser({ role: 'student' });
    await PromoCode.create({ code: 'PREM20', discountPercent: 20 });

    const createRes = await request(app)
      .post('/api/v1/payment/create')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ purpose: 'premium', plan: '30d', promoCode: 'PREM20' });

    expect(createRes.status).toBe(201);
    const { invoiceId } = createRes.body.data;

    // PREMIUM_PRICE_30D testda 5 000 000 (jest.env.js), 20% chegirma -> 4 000 000
    expect(multicardService.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 4000000 })
    );

    const sign = buildSign(invoiceId, 4000000);
    await request(app).post('/api/v1/payment/callback').send({
      invoice_id: invoiceId,
      uuid: 'mock-uuid',
      amount: 4000000,
      status: 'success',
      sign,
    });

    const updatedStudent = await User.findById(student._id);
    expect(updatedStudent.tarif).toBe('premium');

    const promo = await PromoCode.findOne({ code: 'PREM20' });
    expect(promo.usedCount).toBe(1);
  });

  test('allaqachon premium bo\'lgan foydalanuvchi qayta premium sotib olishi mumkin (muddat uzaytiriladi)', async () => {
    const { token: studentToken } = await createUser({
      role: 'student',
      tarif: 'premium',
      premiumExpiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    });

    const res = await request(app)
      .post('/api/v1/payment/create')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ purpose: 'premium', plan: '30d' });

    expect(res.status).toBe(201);
  });

  test('muddati o\'tgan promokod rad etiladi', async () => {
    const { token: studentToken } = await createUser({ role: 'student' });

    await PromoCode.create({
      code: 'ESKI10',
      discountPercent: 10,
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    const res = await request(app)
      .post('/api/v1/payment/create')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ purpose: 'premium', plan: '30d', promoCode: 'ESKI10' });

    expect(res.status).toBe(400);
  });

  test('maxUses tugagan promokod rad etiladi, muvaffaqiyatsiz to\'lov usedCount ni oshirmaydi', async () => {
    const { token: student1Token } = await createUser({ role: 'student' });
    const { token: student2Token } = await createUser({ role: 'student' });

    await PromoCode.create({ code: 'BIRMARTA', discountPercent: 15, maxUses: 1 });

    const firstRes = await request(app)
      .post('/api/v1/payment/create')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ purpose: 'premium', plan: '30d', promoCode: 'BIRMARTA' });
    expect(firstRes.status).toBe(201);

    // to'lov hali draft holatida — callback kelmagan, shuning uchun usedCount hali 0
    let promo = await PromoCode.findOne({ code: 'BIRMARTA' });
    expect(promo.usedCount).toBe(0);

    const { invoiceId } = firstRes.body.data;
    const amount = 4250000; // 5 000 000 * 0.85 (15% chegirma)
    const sign = buildSign(invoiceId, amount);
    await request(app).post('/api/v1/payment/callback').send({
      invoice_id: invoiceId,
      uuid: 'mock-uuid',
      amount,
      status: 'success',
      sign,
    });

    promo = await PromoCode.findOne({ code: 'BIRMARTA' });
    expect(promo.usedCount).toBe(1);

    const secondRes = await request(app)
      .post('/api/v1/payment/create')
      .set('Authorization', `Bearer ${student2Token}`)
      .send({ purpose: 'premium', plan: '30d', promoCode: 'BIRMARTA' });

    expect(secondRes.status).toBe(400);
  });

  test('GET /promo-codes/preview to\'g\'ri chegirmalangan summani qaytaradi', async () => {
    await PromoCode.create({ code: 'ONFIRE25', discountPercent: 25 });

    const res = await request(app).get(
      '/api/v1/promo-codes/preview?code=ONFIRE25&purpose=premium&plan=30d'
    );

    expect(res.status).toBe(200);
    expect(res.body.data.baseAmount).toBe(5000000);
    expect(res.body.data.finalAmount).toBe(3750000);
  });
});
