const request = require('supertest');
const app = require('../src/app');
const User = require('../src/modules/users/user.model');
const { createUser } = require('./helpers');

describe('Leaderboard', () => {
  test('studentlar diamant bo\'yicha kamayish tartibida qaytadi, teacher/admin chiqmaydi', async () => {
    const { user: low, token } = await createUser({ role: 'student' });
    const { user: high } = await createUser({ role: 'student' });
    const { user: mid } = await createUser({ role: 'student' });
    const { user: teacher } = await createUser({ role: 'teacher' });

    await User.findByIdAndUpdate(low._id, { diamonds: 5 });
    await User.findByIdAndUpdate(high._id, { diamonds: 100 });
    await User.findByIdAndUpdate(mid._id, { diamonds: 40 });
    await User.findByIdAndUpdate(teacher._id, { diamonds: 999 });

    const res = await request(app)
      .get('/api/v1/users/leaderboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { leaderboard } = res.body.data;

    expect(leaderboard.map((entry) => entry.diamonds)).toEqual([100, 40, 5]);
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard.find((entry) => entry._id === teacher._id.toString())).toBeUndefined();
  });
});
