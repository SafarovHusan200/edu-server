const request = require('supertest');
const app = require('../src/app');
const { createUser } = require('./helpers');

const URL = '/api/v1/users/class-roster';

describe("Class roster (Super-ustoz doska asboblari)", () => {
  test("student 403 oladi", async () => {
    const { token } = await createUser({ role: 'student' });

    const res = await request(app)
      .get(URL)
      .query({ grade: 5, gradeLetter: 'A' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  test("token berilmasa 401 qaytadi", async () => {
    const res = await request(app).get(URL).query({ grade: 5, gradeLetter: 'A' });
    expect(res.status).toBe(401);
  });

  test("teacher faqat tanlangan sinf o'quvchilarini oladi, faqat _id/name/avatar bilan, ism bo'yicha", async () => {
    const { token } = await createUser({ role: 'teacher' });
    const { user: s1 } = await createUser({ name: 'Zafar', grade: { number: 5, letter: 'A' } });
    const { user: s2 } = await createUser({ name: 'Anvar', grade: { number: 5, letter: 'A' } });
    const { user: otherLetter } = await createUser({ grade: { number: 5, letter: 'B' } });
    const { user: otherGrade } = await createUser({ grade: { number: 6, letter: 'A' } });

    const res = await request(app)
      .get(URL)
      .query({ grade: 5, gradeLetter: 'A' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { students } = res.body.data;
    const ids = students.map((s) => s._id);

    expect(ids).toEqual([s2._id.toString(), s1._id.toString()]);
    expect(ids).not.toContain(otherLetter._id.toString());
    expect(ids).not.toContain(otherGrade._id.toString());

    students.forEach((s) => {
      expect(Object.keys(s).sort()).toEqual(expect.arrayContaining(['_id', 'name']));
      expect(s).not.toHaveProperty('phone');
      expect(s).not.toHaveProperty('balance');
      expect(s).not.toHaveProperty('password');
      expect(s).not.toHaveProperty('role');
    });
  });

  test("bloklangan va tasdiqlanmagan o'quvchilar chiqmaydi", async () => {
    const { token } = await createUser({ role: 'teacher' });
    const { user: ok } = await createUser({ grade: { number: 7, letter: 'V' } });
    const { user: blocked } = await createUser({ grade: { number: 7, letter: 'V' }, isBlocked: true });
    const { user: unverified } = await createUser({ grade: { number: 7, letter: 'V' }, isVerified: false });

    const res = await request(app)
      .get(URL)
      .query({ grade: 7, gradeLetter: 'V' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.students.map((s) => s._id);

    expect(ids).toEqual([ok._id.toString()]);
    expect(ids).not.toContain(blocked._id.toString());
    expect(ids).not.toContain(unverified._id.toString());
  });

  test("admin ham ruxsatga ega", async () => {
    const { token } = await createUser({ role: 'admin' });

    const res = await request(app)
      .get(URL)
      .query({ grade: 5, gradeLetter: 'A' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.students)).toBe(true);
  });

  test.each([
    [{ gradeLetter: 'A' }],
    [{ grade: 5 }],
    [{ grade: 0, gradeLetter: 'A' }],
    [{ grade: 12, gradeLetter: 'A' }],
    [{ grade: 'abc', gradeLetter: 'A' }],
    [{ grade: 5, gradeLetter: 'Z' }],
  ])("noto'g'ri query (%j) 422 qaytaradi", async (q) => {
    const { token } = await createUser({ role: 'teacher' });

    const res = await request(app).get(URL).query(q).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });
});
