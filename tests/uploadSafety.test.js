const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');
const { UPLOADS_ROOT } = require('../src/middleware/upload');
const { createUser } = require('./helpers');

const PNG_BYTES = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const created = [];

afterAll(() => {
  for (const file of created) fs.rmSync(file, { force: true });
});

describe("Fayl yuklash xavfsizligi (/uploads)", () => {
  test("kengaytma fayl nomidan emas, mimetype'dan olinadi (x.html → .png)", async () => {
    const { token } = await createUser({ role: 'student' });

    const res = await request(app)
      .post('/api/v1/users/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', PNG_BYTES, { filename: 'hujum.html', contentType: 'image/png' });

    expect(res.status).toBe(200);
    const avatar = res.body.data.user.avatar;
    expect(avatar).toMatch(/^\/uploads\/avatars\/[^/]+\.png$/);
    created.push(path.join(UPLOADS_ROOT, avatar.replace('/uploads/', '')));

    const served = await request(app).get(avatar);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.headers['content-disposition']).toBeUndefined();
  });

  test("eski .html/.js fayl sahifa sifatida ochilmaydi — yuklab olish + sandbox", async () => {
    const dir = path.join(UPLOADS_ROOT, 'avatars');
    fs.mkdirSync(dir, { recursive: true });
    for (const name of ['eski_hujum.html', 'eski_hujum.js']) {
      const file = path.join(dir, name);
      fs.writeFileSync(file, '<script>alert(1)</script>');
      created.push(file);

      const res = await request(app).get(`/uploads/avatars/${name}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/octet-stream');
      expect(res.headers['content-disposition']).toBe('attachment');
      expect(res.headers['content-security-policy']).toContain('sandbox');
    }
  });

  test("eski .jfif rasm odatdagidek ko'rsatiladi", async () => {
    const file = path.join(UPLOADS_ROOT, 'avatars', 'eski_rasm.jfif');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from('ffd8ffe0', 'hex'));
    created.push(file);

    const res = await request(app).get('/uploads/avatars/eski_rasm.jfif');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toBeUndefined();
  });
});
