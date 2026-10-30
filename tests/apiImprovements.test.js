// tests/apiImprovements.test.js — frontend jamoasi so'ragan qo'shimcha
// endpoint/maydon/filtrlarni tekshiradi (3-ustuvorlik bo'limi, kichikroq o'zgarishlar)

const request = require('supertest');
const app = require('../src/app');
const User = require('../src/modules/users/user.model');
const Notification = require('../src/modules/notifications/notification.model');
const Reward = require('../src/modules/rewards/reward.model');
const RewardRedemption = require('../src/modules/rewards/redemption.model');
const Payment = require('../src/modules/payment/payment.model');
const DailySpin = require('../src/modules/daily-spin/dailySpin.model');
const BookCategory = require('../src/modules/book-categories/bookCategory.model');
const Book = require('../src/modules/books/book.model');
const { createUser } = require('./helpers');

describe('Notifications — unread-count', () => {
  test("to'liq ro'yxatni yuklamasdan faqat sonni beradi", async () => {
    const { user, token } = await createUser({ role: 'student' });

    await Notification.create([
      { user: user._id, type: 'system', title: 'A', message: 'a', isRead: false },
      { user: user._id, type: 'system', title: 'B', message: 'b', isRead: false },
      { user: user._id, type: 'system', title: 'C', message: 'c', isRead: true },
    ]);

    const res = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(2);
  });
});

describe('Leaderboard — me', () => {
  test('student o\'z o\'rnini ko\'radi, teacher uchun me=null', async () => {
    const { user: low, token: lowToken } = await createUser({ role: 'student' });
    const { user: high } = await createUser({ role: 'student' });
    await User.findByIdAndUpdate(low._id, { diamonds: 10 });
    await User.findByIdAndUpdate(high._id, { diamonds: 100 });

    const res = await request(app)
      .get('/api/v1/users/leaderboard')
      .set('Authorization', `Bearer ${lowToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.me).toEqual({ rank: 2, diamonds: 10 });

    const { token: teacherToken } = await createUser({ role: 'teacher' });
    const teacherRes = await request(app)
      .get('/api/v1/users/leaderboard')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(teacherRes.body.data.me).toBeNull();
  });
});

describe('Users — isBlocked filtri', () => {
  test('admin panel "Bloklangan" tabi uchun isBlocked=true faqat bloklanganlarni qaytaradi', async () => {
    const { user: blocked } = await createUser({ role: 'student' });
    await User.findByIdAndUpdate(blocked._id, { isBlocked: true });
    const { user: active } = await createUser({ role: 'student' });
    const { token: adminToken } = await createUser({ role: 'admin' });

    const res = await request(app)
      .get('/api/v1/users')
      .query({ isBlocked: true })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.users.map((u) => u._id);
    expect(ids).toContain(blocked._id.toString());
    expect(ids).not.toContain(active._id.toString());
  });
});

describe('Daily spin — history', () => {
  test("so'nggi yutuqlar eng yangisidan boshlab, limit bilan qaytadi", async () => {
    const { user, token } = await createUser({ role: 'student' });

    for (let i = 0; i < 3; i += 1) {
      await DailySpin.create({
        user: user._id,
        date: `2026-01-0${i + 1}`,
        diamondsWon: i + 1,
        streakAtSpin: 1,
      });
    }

    const res = await request(app)
      .get('/api/v1/daily-spin/history')
      .query({ limit: 2 })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.history).toHaveLength(2);
    expect(res.body.data.history[0].diamondsWon).toBe(3); // eng yangisi birinchi
  });
});

describe('Rewards — bir nechta status filtri', () => {
  test("status=delivered,rejected ikkalasini ham qaytaradi, approved'ni chiqarib tashlaydi", async () => {
    const { user: student } = await createUser({ role: 'student' });
    const { token: adminToken } = await createUser({ role: 'admin' });
    const reward = await Reward.create({ title: 'Sovga', cost: 10 });

    const delivered = await RewardRedemption.create({
      student: student._id,
      reward: reward._id,
      diamondsSpent: 10,
      status: 'delivered',
    });
    const rejected = await RewardRedemption.create({
      student: student._id,
      reward: reward._id,
      diamondsSpent: 10,
      status: 'rejected',
    });
    const approved = await RewardRedemption.create({
      student: student._id,
      reward: reward._id,
      diamondsSpent: 10,
      status: 'approved',
    });

    const res = await request(app)
      .get('/api/v1/rewards/redemptions')
      .query({ status: 'delivered,rejected' })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.redemptions.map((r) => r._id);
    expect(ids).toContain(delivered._id.toString());
    expect(ids).toContain(rejected._id.toString());
    expect(ids).not.toContain(approved._id.toString());
  });
});

describe('Payment — from/to filtri va paymentMethod maydoni', () => {
  test('admin ro\'yxatida createdAt oralig\'i bo\'yicha filtrlanadi va paymentMethod qo\'shiladi', async () => {
    const { user } = await createUser({ role: 'student' });
    const { token: adminToken } = await createUser({ role: 'admin' });

    const old = await Payment.create({
      user: user._id,
      invoiceId: `ord_old_${Date.now()}`,
      amount: 10000,
      purpose: 'wallet',
      status: 'success',
      method: 'multicard',
      createdAt: new Date('2020-01-01'),
    });
    const recent = await Payment.create({
      user: user._id,
      invoiceId: `ord_recent_${Date.now()}`,
      amount: 20000,
      purpose: 'wallet',
      status: 'success',
      method: 'balance',
    });

    const res = await request(app)
      .get('/api/v1/payment')
      .query({ from: '2025-01-01' })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.payments.map((p) => p._id);
    expect(ids).toContain(recent._id.toString());
    expect(ids).not.toContain(old._id.toString());

    const recentPayment = res.body.data.payments.find((p) => p._id === recent._id.toString());
    expect(recentPayment.paymentMethod).toBe('balance');

    const myRes = await request(app)
      .get('/api/v1/payment/my')
      .set('Authorization', `Bearer ${(await createUser({ role: 'student' })).token}`);
    expect(myRes.status).toBe(200);
  });
});

describe('Books — fileSize', () => {
  test('fayl yuklanganda fileSize (baytda) saqlanadi', async () => {
    const { token: teacherToken } = await createUser({ role: 'teacher' });
    const category = await BookCategory.create({
      name: `Adabiyot-${Date.now()}`,
      slug: `adabiyot-${Date.now()}`,
    });

    const createRes = await request(app)
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Kitob', author: 'Muallif', category: category._id.toString() });

    const bookId = createRes.body.data.book._id;

    const fileRes = await request(app)
      .post(`/api/v1/books/${bookId}/file`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .attach('file', Buffer.from('%PDF-1.4 test content'), 'kitob.pdf');

    expect(fileRes.status).toBe(200);
    expect(fileRes.body.data.book.fileSize).toBeGreaterThan(0);

    const book = await Book.findById(bookId);
    expect(book.fileSize).toBe(fileRes.body.data.book.fileSize);
  });
});
