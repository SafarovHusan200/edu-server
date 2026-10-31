const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/app');
const Lesson = require('../src/modules/lessons/lesson.model');
const Enrollment = require('../src/modules/enrollment/enrollment.model');
const { createUser, createCategory, createCourse } = require('./helpers');

// mediaSigning.js'dagi sign() bilan bir xil formula (test ichida muddati o'tgan/soxta
// imzo yasash uchun) — spec: sig = HMAC-SHA256(MEDIA_SECRET, `${filename}:${exp}:${uid}`)
const sign = (filename, exp, uid) =>
  crypto.createHmac('sha256', process.env.MEDIA_SECRET).update(`${filename}:${exp}:${uid}`).digest('hex');

describe('Himoyalangan dars fayllari (/media/lessons)', () => {
  const setupLessonWithVideo = async () => {
    const { user: teacher, token: teacherToken } = await createUser({ role: 'teacher' });
    const { user: student, token: studentToken } = await createUser({ role: 'student' });
    const category = await createCategory();
    const course = await createCourse({
      teacherId: teacher._id,
      categoryId: category._id,
      price: 50000,
      isPublished: true,
    });
    const lesson = await Lesson.create({ course: course._id, title: 'Kirish darsi', order: 0 });
    await Enrollment.create({ student: student._id, course: course._id, status: 'active' });

    const uploadRes = await request(app)
      .post(`/api/v1/lessons/${lesson._id}/video`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .attach('video', Buffer.from('fake mp4 bytes — 20 ta belgidan uzunroq'), {
        filename: 'kirish.mp4',
        contentType: 'video/mp4',
      });

    return { teacher, teacherToken, student, studentToken, course, lesson, videoUrl: uploadRes.body.data.lesson.videoUrl };
  };

  test('eski /uploads/lessons/<fayl> endi tokensiz ham, umuman ham ochilmaydi (static yopilgan)', async () => {
    const res = await request(app).get('/uploads/lessons/random-file.mp4');
    expect(res.status).toBe(404);
  });

  test('kursga yozilgan student uchun GET /lessons/:id dagi videoUrl imzolangan /media/lessons havolasi, va shu havola ochiladi', async () => {
    const { studentToken, lesson, videoUrl } = await setupLessonWithVideo();

    expect(videoUrl).toMatch(/^\/api\/v1\/media\/lessons\//);

    // Har bir havola so'rov yuborgan foydalanuvchiga xos (uid farqli) imzolanadi —
    // shuning uchun teacher yuklaganda olgan URL bilan bir xil emas, lekin shakli bir xil
    const lessonRes = await request(app)
      .get(`/api/v1/lessons/${lesson._id}`)
      .set('Authorization', `Bearer ${studentToken}`);
    const studentVideoUrl = lessonRes.body.data.lesson.videoUrl;
    expect(studentVideoUrl).toMatch(/^\/api\/v1\/media\/lessons\/.+\.mp4\?exp=\d+&uid=.+&sig=.+$/);

    const fileRes = await request(app).get(studentVideoUrl);
    expect(fileRes.status).toBe(200);
    expect(fileRes.headers['content-type']).toBe('video/mp4');
    expect(fileRes.headers['accept-ranges']).toBe('bytes');
    expect(fileRes.headers['cache-control']).toBe('private, max-age=900');
  });

  test('yozilmagan student uchun locked:true qaytadi, videoUrl umuman berilmaydi', async () => {
    const { user: teacher } = await createUser({ role: 'teacher' });
    const { token: otherStudentToken } = await createUser({ role: 'student' });
    const category = await createCategory();
    const course = await createCourse({
      teacherId: teacher._id,
      categoryId: category._id,
      price: 50000,
      isPublished: true,
    });
    const lesson = await Lesson.create({ course: course._id, title: 'Dars', order: 0, videoUrl: '/uploads/lessons/x.mp4' });

    const res = await request(app)
      .get(`/api/v1/lessons/${lesson._id}`)
      .set('Authorization', `Bearer ${otherStudentToken}`);

    expect(res.body.data.lesson.locked).toBe(true);
    expect(res.body.data.lesson.videoUrl).toBeUndefined();
  });

  test('Range so\'rovi 206 Partial Content qaytaradi (video oldinga surish)', async () => {
    const { videoUrl } = await setupLessonWithVideo();

    const res = await request(app).get(videoUrl).set('Range', 'bytes=0-4');

    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toMatch(/^bytes 0-4\//);
    expect(res.headers['content-length']).toBe('5');
  });

  test('sig dagi bitta belgi o\'zgartirilsa 403 qaytadi', async () => {
    const { videoUrl } = await setupLessonWithVideo();

    const tampered = videoUrl.slice(0, -1) + (videoUrl.endsWith('a') ? 'b' : 'a');
    const res = await request(app).get(tampered);

    expect(res.status).toBe(403);
  });

  test('muddati o\'tgan havola (exp o\'tmishda) 403 qaytaradi', async () => {
    const { videoUrl } = await setupLessonWithVideo();
    const url = new URL(`http://x${videoUrl}`);
    const filename = decodeURIComponent(url.pathname.replace('/api/v1/media/lessons/', ''));
    const uid = url.searchParams.get('uid');

    const expiredExp = Math.floor(Date.now() / 1000) - 10;
    const expiredSig = sign(filename, expiredExp, uid);
    const expiredUrl = `/api/v1/media/lessons/${encodeURIComponent(filename)}?exp=${expiredExp}&uid=${uid}&sig=${expiredSig}`;

    const res = await request(app).get(expiredUrl);
    expect(res.status).toBe(403);
  });

  test('noto\'g\'ri fayl nomi (path traversal urinishi) 403 qaytaradi', async () => {
    const res = await request(app).get('/api/v1/media/lessons/..%2F..%2F.env?exp=9999999999&uid=x&sig=x');
    expect([403, 404]).toContain(res.status);
  });
});
