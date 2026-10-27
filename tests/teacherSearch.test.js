const request = require('supertest');
const app = require('../src/app');
const { createUser } = require('./helpers');

describe('Teacher search (quiz sharing uchun)', () => {
  test('faqat teacher rolidagilar qaytadi, so\'ragan o\'zi natijaga kirmaydi', async () => {
    const { user: me, token } = await createUser({ role: 'teacher', name: 'Men Ustoz' });
    const { user: otherTeacher } = await createUser({ role: 'teacher', name: 'Boshqa Ustoz' });
    const { user: student } = await createUser({ role: 'student' });

    const res = await request(app)
      .get('/api/v1/users/teachers')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.teachers.map((t) => t._id);

    expect(ids).toContain(otherTeacher._id.toString());
    expect(ids).not.toContain(me._id.toString());
    expect(ids).not.toContain(student._id.toString());
  });

  test('search parametri ism yoki telefon bo\'yicha filtrlaydi', async () => {
    const { token } = await createUser({ role: 'teacher' });
    const { user: match } = await createUser({ role: 'teacher', name: 'Aliyev Vali' });
    await createUser({ role: 'teacher', name: 'Boshqa Odam' });

    const res = await request(app)
      .get('/api/v1/users/teachers')
      .query({ search: 'Aliyev' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.teachers).toHaveLength(1);
    expect(res.body.data.teachers[0]._id).toBe(match._id.toString());
  });

  test('token berilmasa 401 qaytadi', async () => {
    const res = await request(app).get('/api/v1/users/teachers');
    expect(res.status).toBe(401);
  });
});
