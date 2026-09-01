const request = require('supertest');
const app = require('../src/app');
const Enrollment = require('../src/modules/enrollment/enrollment.model');
const Payment = require('../src/modules/payment/payment.model');
const Quiz = require('../src/modules/quizzes/quiz.model');
const QuizAttempt = require('../src/modules/quiz-attempts/quizAttempt.model');
const { createUser, createCategory, createCourse } = require('./helpers');

describe('Stats', () => {
  const setupCourseWithData = async () => {
    const { user: teacher, token: teacherToken } = await createUser({ role: 'teacher' });
    const { user: activeStudent } = await createUser({ role: 'student' });
    const { user: completedStudent } = await createUser({ role: 'student' });
    const category = await createCategory();
    const course = await createCourse({
      teacherId: teacher._id,
      categoryId: category._id,
      price: 50000,
    });

    await Enrollment.create({ student: activeStudent._id, course: course._id, status: 'active' });
    await Enrollment.create({
      student: completedStudent._id,
      course: course._id,
      status: 'completed',
    });

    await Payment.create({
      user: activeStudent._id,
      invoiceId: `ord_stats_${Date.now()}`,
      amount: 50000,
      purpose: 'course',
      course: course._id,
      status: 'success',
    });

    const quiz = await Quiz.create({
      title: 'Kurs testi',
      targetType: 'course',
      targetId: course._id,
      createdBy: teacher._id,
      passingScore: 50,
      timeLimit: 30,
      targetGrades: [{ number: 5, letter: null }],
    });

    await QuizAttempt.create({
      quiz: quiz._id,
      student: activeStudent._id,
      attemptNumber: 1,
      status: 'reviewed',
      scorePercent: 80,
      passed: true,
    });

    return { teacher, teacherToken, course };
  };

  test('GET /courses/:id/stats to\'g\'ri hisoblaydi, egasi bo\'lmagan teacher 403 oladi', async () => {
    const { teacherToken, course } = await setupCourseWithData();
    const { token: otherTeacherToken } = await createUser({ role: 'teacher' });

    const res = await request(app)
      .get(`/api/v1/courses/${course._id}/stats`)
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    const { stats } = res.body.data;

    expect(stats.enrollment).toEqual({ active: 1, completed: 1, total: 2, completionRate: 50 });
    expect(stats.revenue.total).toBe(50000);
    expect(stats.quizzes.totalQuizzes).toBe(1);
    expect(stats.quizzes.totalAttempts).toBe(1);
    expect(stats.quizzes.avgScore).toBe(80);
    expect(stats.quizzes.passRate).toBe(100);

    const forbiddenRes = await request(app)
      .get(`/api/v1/courses/${course._id}/stats`)
      .set('Authorization', `Bearer ${otherTeacherToken}`);
    expect(forbiddenRes.status).toBe(403);
  });

  test('GET /stats/teacher bir nechta kurs bo\'yicha jamlaydi', async () => {
    const { teacher, teacherToken, course } = await setupCourseWithData();
    const category2 = await createCategory();
    await createCourse({
      teacherId: teacher._id,
      categoryId: category2._id,
      price: 0,
      isPublished: false,
    });

    const res = await request(app)
      .get('/api/v1/stats/teacher')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    const { stats } = res.body.data;

    expect(stats.courses.total).toBe(2);
    expect(stats.courses.published).toBe(1);
    expect(stats.students.total).toBe(2);
    expect(stats.revenue.total).toBe(50000);
    expect(stats.quizzes.totalAttempts).toBe(1);
  });
});
