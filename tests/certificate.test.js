const request = require('supertest');
const app = require('../src/app');
const Certificate = require('../src/modules/certificates/certificate.model');
const { createUser, createCategory, createCourse } = require('./helpers');

describe('Certificates', () => {
  const completeCourse = async () => {
    const { user: teacher, token: teacherToken } = await createUser({ role: 'teacher' });
    const { user: student, token: studentToken } = await createUser({ role: 'student' });
    const category = await createCategory();
    const course = await createCourse({ teacherId: teacher._id, categoryId: category._id, price: 0 });

    const lessonRes = await request(app)
      .post(`/api/v1/courses/${course._id}/lessons`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Yagona dars' });
    const lessonId = lessonRes.body.data.lesson._id;

    await request(app)
      .post(`/api/v1/lessons/${lessonId}/complete`)
      .set('Authorization', `Bearer ${studentToken}`);

    return { teacher, teacherToken, student, studentToken, course };
  };

  test('kurs tugagach sertifikat avtomatik yaratiladi va GET /my orqali ko\'rinadi', async () => {
    const { student, studentToken, course } = await completeCourse();

    const certificate = await Certificate.findOne({ student: student._id, course: course._id });
    expect(certificate).not.toBeNull();
    expect(certificate.certificateNumber).toMatch(/^CERT-[A-F0-9]{12}$/);

    const myRes = await request(app)
      .get('/api/v1/certificates/my')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(myRes.status).toBe(200);
    expect(myRes.body.data.certificates).toHaveLength(1);
  });

  test('GET /:id/download haqiqiy PDF fayl qaytaradi, boshqa student yuklab ololmaydi', async () => {
    const { studentToken, course, student } = await completeCourse();
    const { token: otherStudentToken } = await createUser({ role: 'student' });

    const certificate = await Certificate.findOne({ student: student._id, course: course._id });

    const downloadRes = await request(app)
      .get(`/api/v1/certificates/${certificate._id}/download`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers['content-type']).toMatch(/application\/pdf/);
    expect(Number(downloadRes.headers['content-length'])).toBeGreaterThan(0);

    const forbiddenRes = await request(app)
      .get(`/api/v1/certificates/${certificate._id}/download`)
      .set('Authorization', `Bearer ${otherStudentToken}`);

    expect(forbiddenRes.status).toBe(403);
  });

  test('GET /verify/:certificateNumber public ishlaydi', async () => {
    const { student, course } = await completeCourse();
    const certificate = await Certificate.findOne({ student: student._id, course: course._id });

    const validRes = await request(app).get(
      `/api/v1/certificates/verify/${certificate.certificateNumber}`
    );
    expect(validRes.status).toBe(200);
    expect(validRes.body.data.valid).toBe(true);
    expect(validRes.body.data.studentName).toBe(student.name);

    const invalidRes = await request(app).get('/api/v1/certificates/verify/CERT-DOESNOTEXIST');
    expect(invalidRes.status).toBe(200);
    expect(invalidRes.body.data.valid).toBe(false);
  });
});
