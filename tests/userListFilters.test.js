const request = require('supertest');
const app = require('../src/app');
const User = require('../src/modules/users/user.model');
const { createUser } = require('./helpers');

const DAY = 24 * 60 * 60 * 1000;

describe('GET /users — filtrlar', () => {
  let adminToken;
  let premiumActive;
  let premiumNoExpiry;
  let premiumExpired;
  let standart;

  beforeEach(async () => {
    ({ token: adminToken } = await createUser({ role: 'admin' }));

    ({ user: premiumActive } = await createUser({
      role: 'teacher',
      name: 'Aktiv Premium',
      tarif: 'premium',
      premiumExpiresAt: new Date(Date.now() + 30 * DAY),
    }));
    ({ user: premiumNoExpiry } = await createUser({
      role: 'teacher',
      name: 'Muddatsiz Premium',
      tarif: 'premium',
    }));
    ({ user: premiumExpired } = await createUser({ role: 'teacher', name: 'Eski Premium' }));
    // Muddati o'tgan, lekin hali login qilmagan (downgrade ishlamagan) holat
    await User.collection.updateOne(
      { _id: premiumExpired._id },
      { $set: { tarif: 'premium', premiumExpiresAt: new Date(Date.now() - DAY) } }
    );
    ({ user: standart } = await createUser({ role: 'student', name: 'Oddiy (Student)' }));
  });

  const list = (query) =>
    request(app).get('/api/v1/users').query(query).set('Authorization', `Bearer ${adminToken}`);

  const idsOf = (res) => res.body.data.users.map((u) => u._id).sort();

  test('tarif=premium — faqat amaldagi premiumlar, muddati o\'tgani kirmaydi', async () => {
    const res = await list({ tarif: 'premium', page: 1, limit: 15 });

    expect(res.status).toBe(200);
    expect(idsOf(res)).toEqual(
      [premiumActive._id.toString(), premiumNoExpiry._id.toString()].sort()
    );
    expect(res.body.data.meta.total).toBe(2);
  });

  test('tarif=standart — muddati o\'tgan premium ham standart hisoblanadi', async () => {
    const res = await list({ tarif: 'standart', role: 'teacher' });

    expect(res.status).toBe(200);
    expect(idsOf(res)).toEqual([premiumExpired._id.toString()]);
  });

  test('tarif boshqa filtrlar bilan birga ishlaydi (search + role)', async () => {
    const res = await list({ tarif: 'premium', role: 'teacher', search: 'aktiv' });

    expect(res.status).toBe(200);
    expect(idsOf(res)).toEqual([premiumActive._id.toString()]);
  });

  test('search — regex maxsus belgilari oddiy matn sifatida qidiriladi', async () => {
    const res = await list({ search: '(Student)' });
    expect(res.status).toBe(200);
    expect(idsOf(res)).toEqual([standart._id.toString()]);

    // Avval yopilmagan "(" regex xatosi (500) berardi — endi oddiy belgi sifatida topiladi
    const paren = await list({ search: '(' });
    expect(paren.status).toBe(200);
    expect(idsOf(paren)).toEqual([standart._id.toString()]);
  });

  test.each([
    [{ tarif: 'gold' }],
    [{ role: 'xyz' }],
    [{ isVerified: 'yes' }],
    [{ grade: 'abc' }],
    [{ grade: 12 }],
    [{ gradeLetter: 'Z' }],
  ])('noto\'g\'ri qiymat %j — 422', async (query) => {
    const res = await list(query);
    expect(res.status).toBe(422);
  });

  test('bo\'sh parametrlar (?role=&isVerified=&tarif=) e\'tiborsiz qoldiriladi', async () => {
    const res = await list({ role: '', tarif: '', isVerified: '', isBlocked: '', grade: '' });
    expect(res.status).toBe(200);
    // 1 admin + 3 teacher + 1 student
    expect(res.body.data.meta.total).toBe(5);
  });

  test('gradeLetter kichik harf bilan ham ishlaydi', async () => {
    const res = await list({ grade: 5, gradeLetter: 'a', role: 'student' });
    expect(res.status).toBe(200);
    expect(idsOf(res)).toEqual([standart._id.toString()]);
  });
});
