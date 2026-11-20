const request = require('supertest');
const app = require('../src/app');
const User = require('../src/modules/users/user.model');
const Reward = require('../src/modules/rewards/reward.model');
const { createUser } = require('./helpers');

describe('Rewards (sovg\'alar)', () => {
  test('yetarli diamanti bo\'lgan student sovg\'ani muvaffaqiyatli redeem qiladi', async () => {
    const { user: student, token: studentToken } = await createUser({ role: 'student' });
    await User.findByIdAndUpdate(student._id, { diamonds: 50 });

    const reward = await Reward.create({ title: 'Kitob', cost: 30, stock: 5, isActive: true });

    const res = await request(app)
      .post(`/api/v1/rewards/${reward._id}/redeem`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(201);
    expect(res.body.data.redemption.status).toBe('pending');
    expect(res.body.data.redemption.diamondsSpent).toBe(30);

    const updatedStudent = await User.findById(student._id);
    expect(updatedStudent.diamonds).toBe(20);

    const updatedReward = await Reward.findById(reward._id);
    expect(updatedReward.stock).toBe(4);
  });

  test('yetarli diamanti bo\'lmagan student redeem qila olmaydi', async () => {
    const { user: student, token: studentToken } = await createUser({ role: 'student' });
    await User.findByIdAndUpdate(student._id, { diamonds: 5 });

    const reward = await Reward.create({ title: 'Planshet', cost: 1000, isActive: true });

    const res = await request(app)
      .post(`/api/v1/rewards/${reward._id}/redeem`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(400);

    const updatedStudent = await User.findById(student._id);
    expect(updatedStudent.diamonds).toBe(5);
  });

  test('admin reject qilsa diamant va stock qaytariladi', async () => {
    const { user: student, token: studentToken } = await createUser({ role: 'student' });
    const { token: adminToken } = await createUser({ role: 'admin' });
    await User.findByIdAndUpdate(student._id, { diamonds: 50 });

    const reward = await Reward.create({ title: 'Ruchka', cost: 20, stock: 3, isActive: true });

    const redeemRes = await request(app)
      .post(`/api/v1/rewards/${reward._id}/redeem`)
      .set('Authorization', `Bearer ${studentToken}`);
    const redemptionId = redeemRes.body.data.redemption._id;

    const rejectRes = await request(app)
      .patch(`/api/v1/rewards/redemptions/${redemptionId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Sovg\'a tugagan' });

    expect(rejectRes.status).toBe(200);

    const studentAfterReject = await User.findById(student._id);
    expect(studentAfterReject.diamonds).toBe(50); // qaytarildi

    const rewardAfterReject = await Reward.findById(reward._id);
    expect(rewardAfterReject.stock).toBe(3); // qaytarildi

    // allaqachon yakunlangan (rejected) so'rovni qayta o'zgartirib bo'lmaydi
    const secondUpdateRes = await request(app)
      .patch(`/api/v1/rewards/redemptions/${redemptionId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(secondUpdateRes.status).toBe(400);
  });

  test('admin approve, so\'ng deliver qilsa diamant qaytarilmaydi', async () => {
    const { user: student, token: studentToken } = await createUser({ role: 'student' });
    const { token: adminToken } = await createUser({ role: 'admin' });
    await User.findByIdAndUpdate(student._id, { diamonds: 50 });

    const reward = await Reward.create({ title: 'Sumka', cost: 20, isActive: true });

    const redeemRes = await request(app)
      .post(`/api/v1/rewards/${reward._id}/redeem`)
      .set('Authorization', `Bearer ${studentToken}`);
    const redemptionId = redeemRes.body.data.redemption._id;

    // deliver — avval approve qilinmasdan turib ishlamasligi kerak
    const prematureDeliverRes = await request(app)
      .patch(`/api/v1/rewards/redemptions/${redemptionId}/deliver`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(prematureDeliverRes.status).toBe(400);

    const approveRes = await request(app)
      .patch(`/api/v1/rewards/redemptions/${redemptionId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(approveRes.status).toBe(200);

    const deliverRes = await request(app)
      .patch(`/api/v1/rewards/redemptions/${redemptionId}/deliver`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'Qo\'lda topshirildi' });
    expect(deliverRes.status).toBe(200);

    const studentAfterDeliver = await User.findById(student._id);
    expect(studentAfterDeliver.diamonds).toBe(30); // qaytarilmadi
  });
});

describe('Rewards katalogi tartibi (order)', () => {
  const listIds = (res) => res.body.data.rewards.map((r) => r._id);

  test('yangi sovg\'a ro\'yxat oxiriga tushadi (order = max + 1)', async () => {
    const { token: adminToken } = await createUser({ role: 'admin' });
    await Reward.create({ title: 'Eski', cost: 5, order: 7 });

    const res = await request(app)
      .post('/api/v1/rewards')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Yangi sovg\'a', cost: 10 });

    expect(res.status).toBe(201);
    expect(res.body.data.reward.order).toBe(8);
  });

  test('admin reorder qiladi — GET /rewards (ochiq va includeInactive) yangi tartibda', async () => {
    const { token: adminToken } = await createUser({ role: 'admin' });
    const a = await Reward.create({ title: 'A', cost: 10, isActive: true, order: 0 });
    const b = await Reward.create({ title: 'B', cost: 20, isActive: false, order: 1 });
    const c = await Reward.create({ title: 'C', cost: 30, isActive: true, order: 2 });

    const newOrder = [c, b, a].map((r) => r._id.toString());
    const reorderRes = await request(app)
      .patch('/api/v1/rewards/reorder')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rewardIds: newOrder });

    expect(reorderRes.status).toBe(200);
    expect(reorderRes.body.message).toBe('Tartib saqlandi');

    const adminList = await request(app)
      .get('/api/v1/rewards?includeInactive=true')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listIds(adminList)).toEqual(newOrder);
    expect(adminList.body.data.rewards.map((r) => r.order)).toEqual([0, 1, 2]);

    const publicList = await request(app).get('/api/v1/rewards');
    expect(listIds(publicList)).toEqual([c, a].map((r) => r._id.toString()));
  });

  test('o\'chirilgandan keyin boshqalarning order\'i o\'zgarmaydi, tartib saqlanadi', async () => {
    const { token: adminToken } = await createUser({ role: 'admin' });
    const a = await Reward.create({ title: 'A', cost: 10, isActive: true, order: 0 });
    const b = await Reward.create({ title: 'B', cost: 10, isActive: true, order: 1 });
    const c = await Reward.create({ title: 'C', cost: 10, isActive: true, order: 2 });

    await request(app).delete(`/api/v1/rewards/${b._id}`).set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app).get('/api/v1/rewards');
    expect(listIds(res)).toEqual([a, c].map((r) => r._id.toString()));
    expect((await Reward.findById(c._id)).order).toBe(2);
  });

  test('teacher va student reorder qila olmaydi (403)', async () => {
    const r = await Reward.create({ title: 'A', cost: 10 });
    for (const role of ['teacher', 'student']) {
      const { token } = await createUser({ role });
      const res = await request(app)
        .patch('/api/v1/rewards/reorder')
        .set('Authorization', `Bearer ${token}`)
        .send({ rewardIds: [r._id.toString()] });
      expect(res.status).toBe(403);
    }
  });

  test('noto\'g\'ri ro\'yxat — 422', async () => {
    const { token: adminToken } = await createUser({ role: 'admin' });
    const a = await Reward.create({ title: 'A', cost: 10, order: 0 });
    const b = await Reward.create({ title: 'B', cost: 10, order: 1 });
    const aId = a._id.toString();
    const bId = b._id.toString();
    const foreignId = '0123456789abcdef01234567';

    const cases = [
      { rewardIds: [], msg: null },
      { rewardIds: [aId, 'abc'], msg: null },
      { rewardIds: [aId, aId], msg: null },
      { rewardIds: [aId], msg: "Ro'yxat to'liq emas" },
      { rewardIds: [aId, bId, foreignId], msg: "Ro'yxat to'liq emas" },
      { rewardIds: [aId, foreignId], msg: "Ro'yxat to'liq emas" },
    ];

    for (const { rewardIds, msg } of cases) {
      const res = await request(app)
        .patch('/api/v1/rewards/reorder')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rewardIds });
      expect(res.status).toBe(422);
      expect(res.body.errors[0].field).toBe('rewardIds');
      if (msg) expect(res.body.errors[0].message).toBe(msg);
    }

    // Hech narsa o'zgarmagan
    expect((await Reward.findById(a._id)).order).toBe(0);
    expect((await Reward.findById(b._id)).order).toBe(1);
  });
});
