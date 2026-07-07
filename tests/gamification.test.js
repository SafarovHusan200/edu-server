const request = require('supertest');
const app = require('../src/app');
const User = require('../src/modules/users/user.model');
const Quiz = require('../src/modules/quizzes/quiz.model');
const Question = require('../src/modules/questions/question.model');
const Enrollment = require('../src/modules/enrollment/enrollment.model');
const { createUser, createCategory, createCourse } = require('./helpers');

describe('Gamification: diamonds', () => {
  test('open-ended savolli test teacher tomonidan baholangandan keyin diamant beradi, ikkinchi review qayta bermaydi', async () => {
    const { user: teacher, token: teacherToken } = await createUser({ role: 'teacher' });
    const { user: student, token: studentToken } = await createUser({ role: 'student' });

    const quiz = await Quiz.create({
      title: 'Aralash test',
      targetType: 'standalone',
      createdBy: teacher._id,
      passingScore: 40,
      maxAttempts: 1,
    });

    const mcq = await Question.create({
      quiz: quiz._id,
      text: '2 + 2 = ?',
      type: 'multiple_choice',
      options: [{ label: 'A', text: '3' }, { label: 'B', text: '4' }],
      correctAnswer: 1,
      points: 1,
    });

    const open = await Question.create({
      quiz: quiz._id,
      text: 'Fikringizni yozing',
      type: 'open_ended',
      points: 1,
    });

    const startRes = await request(app)
      .post(`/api/v1/quizzes/${quiz._id}/start`)
      .set('Authorization', `Bearer ${studentToken}`);
    const attemptId = startRes.body.data.attempt._id;

    const submitRes = await request(app)
      .post(`/api/v1/quizzes/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        answers: [
          { questionId: mcq._id.toString(), givenAnswer: 1 },
          { questionId: open._id.toString(), givenAnswer: 'mening javobim' },
        ],
      });

    expect(submitRes.body.data.attempt.status).toBe('submitted');

    let studentAfterSubmit = await User.findById(student._id);
    expect(studentAfterSubmit.diamonds).toBe(0); // hali baholanmagan

    const reviewRes = await request(app)
      .patch(`/api/v1/quizzes/attempts/${attemptId}/review`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ reviewedAnswers: [{ questionId: open._id.toString(), pointsEarned: 0 }] });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.data.attempt.passed).toBe(true);

    let studentAfterReview = await User.findById(student._id);
    expect(studentAfterReview.diamonds).toBe(10);

    // ikkinchi marta review qilinsa qayta diamant berilmasligi kerak
    await request(app)
      .patch(`/api/v1/quizzes/attempts/${attemptId}/review`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ reviewedAnswers: [{ questionId: open._id.toString(), pointsEarned: 1 }] });

    const studentAfterSecondReview = await User.findById(student._id);
    expect(studentAfterSecondReview.diamonds).toBe(10);
  });

  test('darsni tugatish diamant beradi va ikkinchi marta qayta bermaydi (idempotent)', async () => {
    const { user: teacher, token: teacherToken } = await createUser({ role: 'teacher' });
    const { user: student, token: studentToken } = await createUser({ role: 'student' });
    const category = await createCategory();
    const course = await createCourse({ teacherId: teacher._id, categoryId: category._id, price: 0 });

    const lessonRes = await request(app)
      .post(`/api/v1/courses/${course._id}/lessons`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Dars 1' });
    const lessonId = lessonRes.body.data.lesson._id;

    const completeRes = await request(app)
      .post(`/api/v1/lessons/${lessonId}/complete`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.alreadyCompleted).toBe(false);

    let student1 = await User.findById(student._id);
    expect(student1.diamonds).toBe(5);

    const secondCompleteRes = await request(app)
      .post(`/api/v1/lessons/${lessonId}/complete`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(secondCompleteRes.body.data.alreadyCompleted).toBe(true);

    const student2 = await User.findById(student._id);
    expect(student2.diamonds).toBe(5);
  });

  test('kursdagi barcha darslar tugatilganda enrollment.status "completed" bo\'ladi', async () => {
    const { user: teacher, token: teacherToken } = await createUser({ role: 'teacher' });
    const { user: student, token: studentToken } = await createUser({ role: 'student' });
    const category = await createCategory();
    const course = await createCourse({ teacherId: teacher._id, categoryId: category._id, price: 0 });

    const lesson1Res = await request(app)
      .post(`/api/v1/courses/${course._id}/lessons`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Dars 1' });
    const lesson2Res = await request(app)
      .post(`/api/v1/courses/${course._id}/lessons`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Dars 2' });

    await request(app)
      .post(`/api/v1/lessons/${lesson1Res.body.data.lesson._id}/complete`)
      .set('Authorization', `Bearer ${studentToken}`);

    let enrollment = await Enrollment.findOne({ student: student._id, course: course._id });
    expect(enrollment.status).toBe('active');

    await request(app)
      .post(`/api/v1/lessons/${lesson2Res.body.data.lesson._id}/complete`)
      .set('Authorization', `Bearer ${studentToken}`);

    enrollment = await Enrollment.findOne({ student: student._id, course: course._id });
    expect(enrollment.status).toBe('completed');

    const student3 = await User.findById(student._id);
    expect(student3.diamonds).toBe(10); // 2 dars x 5 diamant
  });
});
