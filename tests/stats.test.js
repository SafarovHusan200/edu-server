const request = require('supertest');
const app = require('../src/app');
const Enrollment = require('../src/modules/enrollment/enrollment.model');
const Payment = require('../src/modules/payment/payment.model');
const Quiz = require('../src/modules/quizzes/quiz.model');
const QuizAttempt = require('../src/modules/quiz-attempts/quizAttempt.model');
const Lesson = require('../src/modules/lessons/lesson.model');
const Book = require('../src/modules/books/book.model');
const BookCategory = require('../src/modules/book-categories/bookCategory.model');
const RewardRedemption = require('../src/modules/rewards/redemption.model');
const Reward = require('../src/modules/rewards/reward.model');
const Certificate = require('../src/modules/certificates/certificate.model');
const User = require('../src/modules/users/user.model');
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

  test('GET /stats/top-teachers kontent soniga qarab saralaydi', async () => {
    // Faolroq teacher: 1 kurs (setupCourseWithData) + 1 dars + 1 kitob
    const { teacher: activeTeacher, teacherToken, course } = await setupCourseWithData();

    await Lesson.create({ course: course._id, title: 'Birinchi dars' });

    const bookCategory = await BookCategory.create({ name: 'Adabiyot', slug: `adabiyot-${Date.now()}` });
    await Book.create({
      title: 'Test kitobi',
      author: 'Muallif',
      category: bookCategory._id,
      uploadedBy: activeTeacher._id,
    });

    // Kamroq faol teacher: hech narsa yaratmagan
    const { token: idleTeacherToken } = await createUser({ role: 'teacher' });

    const res = await request(app)
      .get('/api/v1/stats/top-teachers')
      .set('Authorization', `Bearer ${idleTeacherToken}`);

    expect(res.status).toBe(200);
    const { teachers } = res.body.data;

    const activeRow = teachers.find((t) => t._id === activeTeacher._id.toString());
    const idleRow = teachers.find((t) => t.name === 'Test User' && t.coursesCount === 0);

    expect(activeRow).toBeDefined();
    expect(activeRow.coursesCount).toBe(1);
    expect(activeRow.quizzesCount).toBe(1);
    expect(activeRow.lessonsCount).toBe(1);
    expect(activeRow.booksCount).toBe(1);
    expect(activeRow.studentsCount).toBe(2);
    // 1*3 (course) + 1*2 (quiz) + 1*1 (lesson) + 1*2 (book) = 8
    expect(activeRow.activityScore).toBe(8);
    expect(activeRow.rank).toBe(1);

    if (idleRow) {
      expect(idleRow.activityScore).toBe(0);
      expect(activeRow.rank).toBeLessThan(idleRow.rank);
    }
  });

  test('GET /stats/top-teachers — data.me so\'ragan teacherning o\'z o\'rnini beradi', async () => {
    const { teacherToken } = await setupCourseWithData();
    await createUser({ role: 'teacher' }); // boshqa, faolroq emas teacher

    const res = await request(app)
      .get('/api/v1/stats/top-teachers')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.me).not.toBeNull();
    expect(res.body.data.me.rank).toBe(1);
    expect(res.body.data.me.activityScore).toBeGreaterThan(0);

    const { token: studentToken } = await createUser({ role: 'student' });
    const studentRes = await request(app)
      .get('/api/v1/stats/top-teachers')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(studentRes.body.data.me).toBeNull();
  });

  test('GET /stats/admin — 7 ta ko\'rsatkichni bitta chaqiruvda beradi', async () => {
    await createUser({ role: 'student' });
    await createUser({ role: 'student', isVerified: false });
    await createUser({ role: 'teacher' });
    const { user: premiumStudent } = await createUser({ role: 'student' });
    await User.findByIdAndUpdate(premiumStudent._id, {
      tarif: 'premium',
      premiumExpiresAt: new Date(Date.now() + 86400000),
    });
    const { user: expiredPremiumStudent } = await createUser({ role: 'student' });
    await User.findByIdAndUpdate(expiredPremiumStudent._id, {
      tarif: 'premium',
      premiumExpiresAt: new Date(Date.now() - 86400000),
    });

    const { user: rewardStudent } = await createUser({ role: 'student' });
    const reward = await Reward.create({ title: 'Sovga', cost: 10 });
    await RewardRedemption.create({ student: rewardStudent._id, reward: reward._id, diamondsSpent: 10 });

    await Payment.create({
      user: rewardStudent._id,
      invoiceId: `ord_admin_stats_${Date.now()}`,
      amount: 100000,
      purpose: 'wallet',
      status: 'success',
    });

    const { token: adminToken } = await createUser({ role: 'admin' });

    const res = await request(app)
      .get('/api/v1/stats/admin')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const { stats } = res.body.data;

    expect(stats.students).toBeGreaterThanOrEqual(5);
    expect(stats.teachers).toBeGreaterThanOrEqual(1);
    expect(stats.pendingUsers).toBeGreaterThanOrEqual(1);
    expect(stats.pendingRedemptions).toBe(1);
    expect(stats.activePremium).toBe(1); // faqat muddati o'tmagani hisoblanadi
    expect(stats.paymentsThisMonth.total).toBeGreaterThanOrEqual(100000);
    expect(stats.paymentsThisMonth.count).toBeGreaterThanOrEqual(1);

    const { token: teacherToken } = await createUser({ role: 'teacher' });
    const forbidden = await request(app)
      .get('/api/v1/stats/admin')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(forbidden.status).toBe(403);
  });

  test('GET /stats/student — o\'quvchi o\'z dashboard statistikasini oladi', async () => {
    const { user: teacher } = await createUser({ role: 'teacher' });
    const { user: student, token: studentToken } = await createUser({
      role: 'student',
      grade: { number: 7, letter: 'A' },
    });
    const category = await createCategory();
    const course = await createCourse({ teacherId: teacher._id, categoryId: category._id });

    await Enrollment.create({
      student: student._id,
      course: course._id,
      status: 'active',
      completedLessons: [
        { lesson: new (require('mongoose').Types.ObjectId)() },
        { lesson: new (require('mongoose').Types.ObjectId)() },
      ],
    });

    await Certificate.create({
      student: student._id,
      course: course._id,
      certificateNumber: `CERT-STATS-${Date.now()}`,
      pdfPath: '/uploads/certificates/test.pdf',
    });

    await Quiz.create({
      title: 'Faol test',
      targetType: 'standalone',
      createdBy: teacher._id,
      timeLimit: 20,
      isActive: true,
      targetGrades: [{ number: 7, letter: null }],
    });

    const res = await request(app)
      .get('/api/v1/stats/student')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    const { stats } = res.body.data;

    expect(stats.completedLessons).toBe(2);
    expect(stats.certificatesCount).toBe(1);
    expect(stats.rank).toBeGreaterThan(0);
    expect(stats.activeQuizzesCount).toBe(1);
  });
});
