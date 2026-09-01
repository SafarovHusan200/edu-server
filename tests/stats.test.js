const request = require('supertest');
const app = require('../src/app');
const Enrollment = require('../src/modules/enrollment/enrollment.model');
const Payment = require('../src/modules/payment/payment.model');
const Quiz = require('../src/modules/quizzes/quiz.model');
const QuizAttempt = require('../src/modules/quiz-attempts/quizAttempt.model');
const Lesson = require('../src/modules/lessons/lesson.model');
const Book = require('../src/modules/books/book.model');
const BookCategory = require('../src/modules/book-categories/bookCategory.model');
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
});
