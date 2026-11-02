const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/app');
const Lesson = require('../src/modules/lessons/lesson.model');
const Enrollment = require('../src/modules/enrollment/enrollment.model');
const { lessonHlsDir, HLS_STORAGE_DIR } = require('../src/utils/hlsConverter');
const { createUser, createCategory, createCourse } = require('./helpers');

// mediaSigning.js'dagi HLS sign() bilan bir xil formula (sig = HMAC-SHA256(MEDIA_SECRET,
// `${lessonId}:${resourcePath}:${exp}:${uid}`)) — tamper/expired holatlarni qo'lda yasash uchun
const signHls = (lessonId, resourcePath, exp, uid) =>
  crypto
    .createHmac('sha256', process.env.MEDIA_SECRET)
    .update(`${lessonId}:${resourcePath}:${exp}:${uid}`)
    .digest('hex');

const KEY_BYTES = Buffer.from('0123456789abcdef');
const SEG_480P = Buffer.from('fake-480p-ts-bytes');
const SEG_720P = Buffer.from('fake-720p-ts-bytes');

const variantContent = () =>
  '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n' +
  '#EXT-X-TARGETDURATION:6\n#EXTINF:6.0,\nseg0.ts\n#EXT-X-ENDLIST\n';

// ffmpeg ishlatilmaydi — HLS fayllari qo'lda, haqiqiy konvertatsiyadagi struktura bilan
// bir xil shaklda yoziladi (hls.controller.js shularni o'qiydi/qayta imzolaydi)
const setupReadyLesson = async () => {
  const { user: teacher } = await createUser({ role: 'teacher' });
  const { user: student, token: studentToken } = await createUser({ role: 'student' });
  const category = await createCategory();
  const course = await createCourse({
    teacherId: teacher._id,
    categoryId: category._id,
    price: 50000,
    isPublished: true,
  });
  const lesson = await Lesson.create({
    course: course._id,
    title: 'HLS darsi',
    order: 0,
    videoUrl: '/uploads/lessons/fake-source.mp4',
    videoStatus: 'ready',
  });
  await Enrollment.create({ student: student._id, course: course._id, status: 'active' });

  const dir = lessonHlsDir(lesson._id);
  await fs.promises.mkdir(path.join(dir, '480p'), { recursive: true });
  await fs.promises.mkdir(path.join(dir, '720p'), { recursive: true });
  await fs.promises.writeFile(path.join(dir, 'key.bin'), KEY_BYTES);
  await fs.promises.writeFile(
    path.join(dir, 'master.m3u8'),
    '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=854x480\n480p/playlist.m3u8\n' +
      '#EXT-X-STREAM-INF:BANDWIDTH=1800000,RESOLUTION=1280x720\n720p/playlist.m3u8\n'
  );
  await fs.promises.writeFile(path.join(dir, '480p', 'playlist.m3u8'), variantContent());
  await fs.promises.writeFile(path.join(dir, '480p', 'seg0.ts'), SEG_480P);
  await fs.promises.writeFile(path.join(dir, '720p', 'playlist.m3u8'), variantContent());
  await fs.promises.writeFile(path.join(dir, '720p', 'seg0.ts'), SEG_720P);

  return { teacher, student, studentToken, course, lesson };
};

describe('HLS (AES-128 shifrlangan) dars videosi (/media/hls)', () => {
  afterAll(async () => {
    await fs.promises.rm(HLS_STORAGE_DIR, { recursive: true, force: true });
  });

  test('GET /lessons/:id — videoStatus="ready" bo\'lsa video:{type:"hls",url} qaytadi, videoUrl yo\'q', async () => {
    const { studentToken, lesson } = await setupReadyLesson();

    const res = await request(app)
      .get(`/api/v1/lessons/${lesson._id}`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.lesson.videoStatus).toBe('ready');
    expect(res.body.data.lesson.videoUrl).toBeUndefined();
    expect(res.body.data.lesson.video).toEqual({
      type: 'hls',
      url: expect.stringMatching(
        new RegExp(`^/api/v1/media/hls/${lesson._id}/master\\.m3u8\\?exp=\\d+&uid=.+&sig=.+$`)
      ),
    });
  });

  test('master.m3u8 -> variant playlist -> segment: to\'liq zanjir ishlaydi', async () => {
    const { studentToken, lesson } = await setupReadyLesson();

    const lessonRes = await request(app)
      .get(`/api/v1/lessons/${lesson._id}`)
      .set('Authorization', `Bearer ${studentToken}`);
    const masterUrl = lessonRes.body.data.lesson.video.url;

    const masterRes = await request(app).get(masterUrl);
    expect(masterRes.status).toBe(200);
    expect(masterRes.headers['content-type']).toMatch(/mpegurl/);

    const variantLine = masterRes.text
      .split('\n')
      .find((line) => line.includes('/480p/playlist.m3u8'));
    expect(variantLine).toBeDefined();

    const variantRes = await request(app).get(variantLine.trim());
    expect(variantRes.status).toBe(200);
    expect(variantRes.text).toMatch(
      new RegExp(`URI="/api/v1/media/hls/${lesson._id}/key"`)
    );

    const segLine = variantRes.text.split('\n').find((line) => line.includes('/480p/seg/seg0.ts'));
    expect(segLine).toBeDefined();

    const segRes = await request(app).get(segLine.trim());
    expect(segRes.status).toBe(200);
    expect(segRes.headers['content-type']).toBe('video/mp2t');
    expect(Buffer.compare(segRes.body, SEG_480P)).toBe(0);
  });

  test('key endpoint: tokensiz 401, kursga yozilgan student uchun 200 (haqiqiy kalit baytlari)', async () => {
    const { studentToken, lesson } = await setupReadyLesson();

    const noAuthRes = await request(app).get(`/api/v1/media/hls/${lesson._id}/key`);
    expect(noAuthRes.status).toBe(401);

    const res = await request(app)
      .get(`/api/v1/media/hls/${lesson._id}/key`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/octet-stream');
    expect(Buffer.compare(res.body, KEY_BYTES)).toBe(0);
  });

  test('key endpoint: yozilmagan boshqa student uchun 403', async () => {
    const { lesson } = await setupReadyLesson();
    const { token: otherStudentToken } = await createUser({ role: 'student' });

    const res = await request(app)
      .get(`/api/v1/media/hls/${lesson._id}/key`)
      .set('Authorization', `Bearer ${otherStudentToken}`);

    expect(res.status).toBe(403);
  });

  test('master.m3u8: sig dagi bitta belgi o\'zgartirilsa 403', async () => {
    const { studentToken, lesson } = await setupReadyLesson();

    const lessonRes = await request(app)
      .get(`/api/v1/lessons/${lesson._id}`)
      .set('Authorization', `Bearer ${studentToken}`);
    const masterUrl = lessonRes.body.data.lesson.video.url;
    const tampered = masterUrl.slice(0, -1) + (masterUrl.endsWith('a') ? 'b' : 'a');

    const res = await request(app).get(tampered);
    expect(res.status).toBe(403);
  });

  test('master.m3u8: muddati o\'tgan havola 403', async () => {
    const { lesson } = await setupReadyLesson();

    const uid = 'someuser';
    const expiredExp = Math.floor(Date.now() / 1000) - 10;
    const sig = signHls(lesson._id, 'master.m3u8', expiredExp, uid);
    const url = `/api/v1/media/hls/${lesson._id}/master.m3u8?exp=${expiredExp}&uid=${uid}&sig=${sig}`;

    const res = await request(app).get(url);
    expect(res.status).toBe(403);
  });

  test('noto\'g\'ri variant nomi -> 404, noto\'g\'ri segment fayl nomi (path traversal) -> 403', async () => {
    const { lesson } = await setupReadyLesson();

    const badVariantRes = await request(app).get(
      `/api/v1/media/hls/${lesson._id}/1080p/playlist.m3u8?exp=9999999999&uid=x&sig=x`
    );
    expect(badVariantRes.status).toBe(404);

    const traversalRes = await request(app).get(
      `/api/v1/media/hls/${lesson._id}/480p/seg/..%2F..%2Fkey.bin?exp=9999999999&uid=x&sig=x`
    );
    expect([403, 404]).toContain(traversalRes.status);
  });
});
