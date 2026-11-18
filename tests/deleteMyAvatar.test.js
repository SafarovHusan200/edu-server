const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/modules/users/user.model');
const { UPLOADS_ROOT } = require('../src/middleware/upload');
const { createUser } = require('./helpers');

const URL = '/api/v1/users/me/avatar';
const AVATARS_DIR = path.join(UPLOADS_ROOT, 'avatars');

const createAvatarFile = () => {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
  const fileName = `test_${Date.now()}_${Math.round(Math.random() * 1e9)}.png`;
  const absolutePath = path.join(AVATARS_DIR, fileName);
  fs.writeFileSync(absolutePath, 'fake-image');
  return { absolutePath, publicPath: `/uploads/avatars/${fileName}` };
};

describe('DELETE /users/me/avatar', () => {
  test('token berilmasa 401 qaytadi', async () => {
    const res = await request(app).delete(URL);
    expect(res.status).toBe(401);
  });

  test("student o'z avatarini o'chiradi: fayl diskdan o'chadi, avatar null bo'ladi", async () => {
    const { absolutePath, publicPath } = createAvatarFile();
    const { user, token } = await createUser({ role: 'student', avatar: publicPath });

    const res = await request(app).delete(URL).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user._id).toBe(user._id.toString());
    expect(res.body.data.user.avatar).toBeNull();
    expect(res.body.data.user).not.toHaveProperty('password');
    expect(fs.existsSync(absolutePath)).toBe(false);

    const fresh = await User.findById(user._id);
    expect(fresh.avatar).toBeNull();
  });

  test("avatar yo'q bo'lsa ham 200 qaytadi (idempotent)", async () => {
    const { token } = await createUser({ role: 'teacher' });

    const first = await request(app).delete(URL).set('Authorization', `Bearer ${token}`);
    const second = await request(app).delete(URL).set('Authorization', `Bearer ${token}`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.data.user.avatar ?? null).toBeNull();
  });

  test("diskda fayl topilmasa ham xato bermaydi", async () => {
    const { token, user } = await createUser({ avatar: '/uploads/avatars/missing_file.png' });

    const res = await request(app).delete(URL).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect((await User.findById(user._id)).avatar).toBeNull();
  });

  test("tashqi (Telegram) URL'li avatar — faqat null qilinadi", async () => {
    const { token } = await createUser({ avatar: 'https://t.me/i/userpic/320/abc.jpg' });

    const res = await request(app).delete(URL).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.avatar).toBeNull();
  });
});
