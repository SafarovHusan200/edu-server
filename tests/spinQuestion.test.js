const request = require('supertest');
const app = require('../src/app');
const { createUser } = require('./helpers');

const validBody = () => ({
  grade: 5,
  question: 'Dunyodagi eng katta okean qaysi?',
  options: ['Hind okeani', 'Atlantika okeani', 'Tinch okean', 'Arktika okeani'],
  correctIndex: 2,
});

describe('Spin Questions (admin) — /spin-questions', () => {
  test('admin yangi savol qo\'sha oladi (201)', async () => {
    const { token } = await createUser({ role: 'admin' });

    const res = await request(app)
      .post('/api/v1/spin-questions')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody());

    expect(res.status).toBe(201);
    expect(res.body.data.question.grade).toBe(5);
    expect(res.body.data.question.options).toHaveLength(4);
    expect(res.body.data.question.isActive).toBe(true);
  });

  test('student savol qo\'sha olmaydi (403)', async () => {
    const { token } = await createUser({ role: 'student' });

    const res = await request(app)
      .post('/api/v1/spin-questions')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody());

    expect(res.status).toBe(403);
  });

  test('options 4 tadan kam/ko\'p bo\'lsa 422', async () => {
    const { token } = await createUser({ role: 'admin' });

    const res = await request(app)
      .post('/api/v1/spin-questions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody(), options: ['A', 'B', 'C'] });

    expect(res.status).toBe(422);
  });

  test('GET /spin-questions?grade= — faqat shu sinfdagilarni qaytaradi', async () => {
    const { token } = await createUser({ role: 'admin' });

    await request(app).post('/api/v1/spin-questions').set('Authorization', `Bearer ${token}`).send(validBody());
    await request(app)
      .post('/api/v1/spin-questions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody(), grade: 7, question: 'Boshqa savol' });

    const res = await request(app)
      .get('/api/v1/spin-questions?grade=5')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.questions.every((q) => q.grade === 5)).toBe(true);
  });

  test('category="logic" uchun grade bermasa ham 201 (hammaga umumiy)', async () => {
    const { token } = await createUser({ role: 'admin' });

    const res = await request(app)
      .post('/api/v1/spin-questions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category: 'logic',
        question: 'Agar hamma "A" yolg\'onchi bo\'lsa, u o\'zi haqida nima deydi?',
        options: ['Men rost gapiraman', 'Men yolg\'on gapiraman', 'Bilmayman', 'Hech narsa'],
        correctIndex: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.question.category).toBe('logic');
    expect(res.body.data.question.grade).toBeNull();
  });

  test('category="knowledge" uchun grade berilmasa 422', async () => {
    const { token } = await createUser({ role: 'admin' });

    const res = await request(app)
      .post('/api/v1/spin-questions')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody(), grade: undefined, category: 'knowledge' });

    expect(res.status).toBe(422);
  });

  test('PATCH va DELETE ishlaydi', async () => {
    const { token } = await createUser({ role: 'superadmin' });

    const created = await request(app)
      .post('/api/v1/spin-questions')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody());
    const id = created.body.data.question._id;

    const patched = await request(app)
      .patch(`/api/v1/spin-questions/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });
    expect(patched.status).toBe(200);
    expect(patched.body.data.question.isActive).toBe(false);

    const deleted = await request(app)
      .delete(`/api/v1/spin-questions/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleted.status).toBe(200);
  });
});
