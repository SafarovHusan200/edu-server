// O'qituvchi PATCH so'rovida o'zgartirmasligi kerak bo'lgan maydonlar (egalik, reyting,
// darsning kursi, savolning quiz'i va h.k.) jimgina e'tiborsiz qoldiriladi
const request = require('supertest');
const app = require('../src/app');
const Course = require('../src/modules/courses/course.model');
const Lesson = require('../src/modules/lessons/lesson.model');
const Book = require('../src/modules/books/book.model');
const BookCategory = require('../src/modules/book-categories/bookCategory.model');
const Quiz = require('../src/modules/quizzes/quiz.model');
const Question = require('../src/modules/questions/question.model');
const { createUser, createCategory, createCourse } = require('./helpers');

const setup = async () => {
  const { user: teacher, token } = await createUser({ role: 'teacher' });
  const { user: other } = await createUser({ role: 'teacher' });
  const category = await createCategory();
  const course = await createCourse({ teacherId: teacher._id, categoryId: category._id });
  const otherCourse = await createCourse({ teacherId: other._id, categoryId: category._id });
  return { teacher, token, other, course, otherCourse };
};

const patch = (url, token, body) => request(app).patch(url).set('Authorization', `Bearer ${token}`).send(body);

describe("Mass assignment himoyasi (PATCH faqat ruxsat etilgan maydonlarni o'zgartiradi)", () => {
  test("kurs: teacher va reytingni o'zgartirib bo'lmaydi, oddiy maydonlar o'zgaradi", async () => {
    const { token, teacher, other, course } = await setup();

    const res = await patch(`/api/v1/courses/${course._id}`, token, {
      title: 'Yangi nom',
      price: 500000,
      teacher: other._id,
      ratingAvg: 5,
      ratingCount: 1000,
    });

    expect(res.status).toBe(200);
    const saved = await Course.findById(course._id);
    expect(saved.title).toBe('Yangi nom');
    expect(saved.price).toBe(500000);
    expect(saved.teacher.toString()).toBe(teacher._id.toString());
    expect(saved.ratingAvg).toBe(0);
    expect(saved.ratingCount).toBe(0);
  });

  test("dars: boshqa kursga ko'chirib bo'lmaydi; videoUrl faqat tashqi havola", async () => {
    const { token, course, otherCourse } = await setup();
    const lesson = await Lesson.create({ course: course._id, title: 'Dars 1' });

    const res = await patch(`/api/v1/lessons/${lesson._id}`, token, {
      title: 'Dars 1 (yangilangan)',
      course: otherCourse._id,
      videoStatus: 'ready',
    });
    expect(res.status).toBe(200);
    const saved = await Lesson.findById(lesson._id);
    expect(saved.title).toBe('Dars 1 (yangilangan)');
    expect(saved.course.toString()).toBe(course._id.toString());
    expect(saved.videoStatus).toBe('none');

    const stolen = await patch(`/api/v1/lessons/${lesson._id}`, token, {
      videoUrl: '/uploads/lessons/boshqa_kursning_videosi.mp4',
    });
    expect(stolen.status).toBe(400);

    const external = await patch(`/api/v1/lessons/${lesson._id}`, token, {
      videoUrl: 'https://www.youtube.com/watch?v=abc',
    });
    expect(external.status).toBe(200);
    expect((await Lesson.findById(lesson._id)).videoUrl).toBe('https://www.youtube.com/watch?v=abc');
  });

  test("dars: o'z yuklangan videosi o'zgarmasdan qayta yuborilsa — xato emas", async () => {
    const { token, course } = await setup();
    const own = '/uploads/lessons/123_456.mp4';
    const lesson = await Lesson.create({ course: course._id, title: 'Dars', videoUrl: own });

    const res = await patch(`/api/v1/lessons/${lesson._id}`, token, { title: 'Dars 2', videoUrl: own });
    expect(res.status).toBe(200);
    expect((await Lesson.findById(lesson._id)).videoUrl).toBe(own);
  });

  test("kitob: uploadedBy va downloadsCount o'zgarmaydi", async () => {
    const { token, teacher, other } = await setup();
    const category = await BookCategory.create({ name: 'Adabiyot', slug: `adabiyot-${Date.now()}` });
    const book = await Book.create({
      title: 'Kitob',
      author: 'Muallif',
      category: category._id,
      uploadedBy: teacher._id,
    });

    const res = await patch(`/api/v1/books/${book._id}`, token, {
      title: 'Kitob 2',
      uploadedBy: other._id,
      downloadsCount: 99999,
    });
    expect(res.status).toBe(200);
    const saved = await Book.findById(book._id);
    expect(saved.title).toBe('Kitob 2');
    expect(saved.uploadedBy.toString()).toBe(teacher._id.toString());
    expect(saved.downloadsCount).toBe(0);
  });

  test("quiz: createdBy o'zgarmaydi; savolni boshqa quiz'ga ko'chirib bo'lmaydi", async () => {
    const { token, teacher, other } = await setup();
    const grades = [{ number: 5, letter: 'A' }];
    const quiz = await Quiz.create({ title: 'Mening testim', targetType: 'standalone', createdBy: teacher._id, timeLimit: 20, targetGrades: grades });
    const otherQuiz = await Quiz.create({ title: 'Begona test', targetType: 'standalone', createdBy: other._id, timeLimit: 20, targetGrades: grades });
    const question = await Question.create({
      quiz: quiz._id,
      text: '2+2?',
      type: 'true_false',
      correctAnswer: 'true',
    });

    const quizRes = await patch(`/api/v1/quizzes/${quiz._id}`, token, { title: 'Yangi nom', createdBy: other._id });
    expect(quizRes.status).toBe(200);
    const savedQuiz = await Quiz.findById(quiz._id);
    expect(savedQuiz.title).toBe('Yangi nom');
    expect(savedQuiz.createdBy.toString()).toBe(teacher._id.toString());

    const qRes = await patch(`/api/v1/quizzes/questions/${question._id}`, token, {
      text: '3+3?',
      quiz: otherQuiz._id,
    });
    expect(qRes.status).toBe(200);
    const savedQ = await Question.findById(question._id);
    expect(savedQ.text).toBe('3+3?');
    expect(savedQ.quiz.toString()).toBe(quiz._id.toString());
  });
});
