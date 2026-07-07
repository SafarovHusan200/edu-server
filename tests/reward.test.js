const request = require('supertest');
const app = require('../src/app');
const User = require('../src/modules/users/user.model');
const Reward = require('../src/modules/rewards/reward.model');
const { createUser } = require('./helpers');

describe('Rewards (sovg\'alar)', () => {
  test('yetarli diamanti bo\'lgan student sovg\'ani muvaffaqiyatli redeem qiladi', async () => {
    const { user: student, token: studentToken } = await createUser({ role: 'student' });
    await User.findByIdAndUpdate(student._id, { diamonds: 50 });

    const reward = await Reward.create({ title: 'Kitob', cost: 30, stock: 5 });

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

    const reward = await Reward.create({ title: 'Planshet', cost: 1000 });

    const res = await request(app)
      .post(`/api/v1/rewards/${reward._id}/redeem`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(400);

    const updatedStudent = await User.findById(student._id);
    expect(updatedStudent.diamonds).toBe(5);
  });

  test('admin "rejected" qilsa diamant va stock qaytariladi', async () => {
    const { user: student, token: studentToken } = await createUser({ role: 'student' });
    const { token: adminToken } = await createUser({ role: 'admin' });
    await User.findByIdAndUpdate(student._id, { diamonds: 50 });

    const reward = await Reward.create({ title: 'Ruchka', cost: 20, stock: 3 });

    const redeemRes = await request(app)
      .post(`/api/v1/rewards/${reward._id}/redeem`)
      .set('Authorization', `Bearer ${studentToken}`);
    const redemptionId = redeemRes.body.data.redemption._id;

    const rejectRes = await request(app)
      .patch(`/api/v1/rewards/redemptions/${redemptionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'rejected', adminNote: 'Sovg\'a tugagan' });

    expect(rejectRes.status).toBe(200);

    const studentAfterReject = await User.findById(student._id);
    expect(studentAfterReject.diamonds).toBe(50); // qaytarildi

    const rewardAfterReject = await Reward.findById(reward._id);
    expect(rewardAfterReject.stock).toBe(3); // qaytarildi

    // pending bo'lmagan so'rovni qayta o'zgartirib bo'lmaydi
    const secondUpdateRes = await request(app)
      .patch(`/api/v1/rewards/redemptions/${redemptionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'delivered' });

    expect(secondUpdateRes.status).toBe(400);
  });

  test('admin "delivered" qilsa diamant qaytarilmaydi', async () => {
    const { user: student, token: studentToken } = await createUser({ role: 'student' });
    const { token: adminToken } = await createUser({ role: 'admin' });
    await User.findByIdAndUpdate(student._id, { diamonds: 50 });

    const reward = await Reward.create({ title: 'Sumka', cost: 20 });

    const redeemRes = await request(app)
      .post(`/api/v1/rewards/${reward._id}/redeem`)
      .set('Authorization', `Bearer ${studentToken}`);
    const redemptionId = redeemRes.body.data.redemption._id;

    await request(app)
      .patch(`/api/v1/rewards/redemptions/${redemptionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'delivered' });

    const studentAfterDeliver = await User.findById(student._id);
    expect(studentAfterDeliver.diamonds).toBe(30); // qaytarilmadi
  });
});
