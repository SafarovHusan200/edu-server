const request = require('supertest');
const app = require('../src/app');
const User = require('../src/modules/users/user.model');

// Ro'yxatdan o'tgan (lekin hali tasdiqlanmagan) userni admin tasdiqlagandek qilib
// belgilaydi — login talab qiladigan testlarda shundan foydalaniladi
const verifyUser = (userId) => User.findByIdAndUpdate(userId, { isVerified: true });

describe('Auth', () => {
  test('register yangi studentni yaratadi, lekin token qaytarmaydi (tasdiqlanmagan)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Ali Valiyev',
      phone: '998901234567',
      password: 'password123',
      role: 'student',
      grade: { number: 5, letter: 'A' },
    });

    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeUndefined();
    expect(res.body.data.user.phone).toBe('998901234567');
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.user.isVerified).toBe(false);
  });

  test('bir xil telefon raqami bilan ikkinchi marta ro\'yxatdan o\'tib bo\'lmaydi', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Ali',
      phone: '998901111111',
      password: 'password123',
      role: 'student',
      grade: { number: 5, letter: 'A' },
    });

    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Boshqa',
      phone: '998901111111',
      password: 'password123',
      role: 'student',
      grade: { number: 6, letter: 'B' },
    });

    expect(res.status).toBe(400);
  });

  test('tasdiqlanmagan foydalanuvchi login qila olmaydi', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Tasdiqlanmagan',
      phone: '998902000000',
      password: 'password123',
      role: 'student',
      grade: { number: 5, letter: 'A' },
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: '998902000000', password: 'password123' });

    expect(res.status).toBe(403);
  });

  test('noto\'g\'ri parol bilan login rad etiladi', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Ali',
      phone: '998902222222',
      password: 'correct-password',
      role: 'student',
      grade: { number: 5, letter: 'A' },
    });
    await verifyUser(registerRes.body.data.user._id);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: '998902222222', password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  test('to\'g\'ri ma\'lumotlar bilan login va /auth/me ishlaydi', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Ali',
      phone: '998903333333',
      password: 'password123',
      role: 'student',
      grade: { number: 5, letter: 'A' },
    });
    await verifyUser(registerRes.body.data.user._id);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: '998903333333', password: 'password123' });

    expect(loginRes.status).toBe(200);
    const { token } = loginRes.body.data;

    const meRes = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.phone).toBe('998903333333');
  });

  test('bloklangan foydalanuvchi login qila olmaydi', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Bloklangan',
      phone: '998904444444',
      password: 'password123',
      role: 'student',
      grade: { number: 5, letter: 'A' },
    });

    await User.findByIdAndUpdate(registerRes.body.data.user._id, { isBlocked: true, isVerified: true });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: '998904444444', password: 'password123' });

    expect(res.status).toBe(403);
  });

  test('logout qilingandan keyin eski token endi ishlamaydi', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Logout Test',
      phone: '998905555555',
      password: 'password123',
      role: 'student',
      grade: { number: 5, letter: 'A' },
    });
    await verifyUser(registerRes.body.data.user._id);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: '998905555555', password: 'password123' });
    const { token } = loginRes.body.data;

    const beforeLogout = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(beforeLogout.status).toBe(200);

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(logoutRes.status).toBe(200);

    const afterLogout = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(afterLogout.status).toBe(401);
  });

  test('parol o\'zgartirilgandan keyin eski token yaroqsiz bo\'ladi, yangi token esa ishlaydi', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Password Change Test',
      phone: '998906666666',
      password: 'oldpassword123',
      role: 'student',
      grade: { number: 5, letter: 'A' },
    });
    await verifyUser(registerRes.body.data.user._id);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: '998906666666', password: 'oldpassword123' });
    const oldToken = loginRes.body.data.token;

    const changeRes = await request(app)
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ oldPassword: 'oldpassword123', newPassword: 'newpassword123' });

    expect(changeRes.status).toBe(200);
    const newToken = changeRes.body.data.token;
    expect(newToken).toBeDefined();
    expect(newToken).not.toBe(oldToken);

    const withOldToken = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${oldToken}`);
    expect(withOldToken.status).toBe(401);

    const withNewToken = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${newToken}`);
    expect(withNewToken.status).toBe(200);

    const loginWithNewPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: '998906666666', password: 'newpassword123' });
    expect(loginWithNewPassword.status).toBe(200);
  });
});
