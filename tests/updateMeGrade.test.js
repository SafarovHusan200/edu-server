const request = require('supertest');
const app = require('../src/app');
const User = require('../src/modules/users/user.model');
const { createUser } = require('./helpers');

const URL = '/api/v1/users/me';

describe("PATCH /users/me — sinf (grade) o'zgartirilmaydi", () => {
  test("student grade yuborsa 200, lekin sinfi o'zgarmaydi", async () => {
    const { user, token } = await createUser({ role: 'student', grade: { number: 5, letter: 'A' } });

    const res = await request(app)
      .patch(URL)
      .set('Authorization', `Bearer ${token}`)
      .send({ grade: { number: 9, letter: 'B' } });

    expect(res.status).toBe(200);
    expect(res.body.data.user.grade).toMatchObject({ number: 5, letter: 'A' });

    const fresh = await User.findById(user._id);
    expect(fresh.grade.number).toBe(5);
    expect(fresh.grade.letter).toBe('A');
  });

  test("noto'g'ri grade qiymati ham validatsiya xatosi bermaydi — shunchaki e'tiborsiz", async () => {
    const { user, token } = await createUser({ role: 'student', grade: { number: 5, letter: 'A' } });

    const res = await request(app)
      .patch(URL)
      .set('Authorization', `Bearer ${token}`)
      .send({ grade: { number: 99, letter: 'Z' } });

    expect(res.status).toBe(200);
    expect((await User.findById(user._id)).grade.number).toBe(5);
  });

  test("teacher name'ni o'zgartira oladi, grade esa e'tiborsiz qoladi", async () => {
    const { user, token } = await createUser({ role: 'teacher' });

    const res = await request(app)
      .patch(URL)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Yangi Ism', grade: { number: 7, letter: 'A' } });

    expect(res.status).toBe(200);
    const fresh = await User.findById(user._id);
    expect(fresh.name).toBe('Yangi Ism');
    expect(fresh.grade?.number ?? null).toBeNull();
  });
});
