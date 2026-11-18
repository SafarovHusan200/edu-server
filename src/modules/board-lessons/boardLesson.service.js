// src/modules/board-lessons/boardLesson.service.js

const BoardLesson = require('./boardLesson.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, buildMeta } = require('../../utils/paginate');

const STAFF_ROLES = ['admin', 'superadmin'];
const TITLE_MAX = 120;
const COPY_SUFFIX = ' (nusxa)';

const canManage = (lesson, user) =>
  STAFF_ROLES.includes(user.role) || lesson.createdBy.toString() === user._id.toString();

const findManageable = async (id, user) => {
  const lesson = await BoardLesson.findById(id);
  if (!lesson) throw new ApiError(404, 'Dars topilmadi');
  if (!canManage(lesson, user)) throw new ApiError(403, 'Bu dars sizga tegishli emas');
  return lesson;
};

// To'liq javob: summary maydonlari (coverImage, slideCount, exerciseCount) + kontent
const toLessonResponse = (doc) => {
  const lesson = doc.toObject();
  return {
    _id: lesson._id,
    title: lesson.title,
    description: lesson.description,
    subject: lesson.subject,
    grade: lesson.grade,
    theme: lesson.theme,
    coverImage: lesson.slides.find((s) => s.image)?.image ?? null,
    slideCount: lesson.slides.length,
    exerciseCount: lesson.exercises.length,
    slides: lesson.slides,
    exercises: lesson.exercises,
    createdBy: lesson.createdBy,
    createdAt: lesson.createdAt,
    updatedAt: lesson.updatedAt,
  };
};

// Body'dan faqat ruxsat etilgan maydonlar (validatsiyadan o'tgan)
const pickFields = ({ title, description, subject, grade, theme, slides, exercises }) => {
  const fields = { title, description, subject, grade, theme, slides, exercises };
  Object.keys(fields).forEach((k) => fields[k] === undefined && delete fields[k]);
  return fields;
};

// ─────────────── CRUD ───────────────

const createLesson = async (user, body) => {
  const lesson = await BoardLesson.create({ ...pickFields(body), createdBy: user._id });
  return toLessonResponse(lesson);
};

const getLessons = async (user, { page, limit, search, grade, all }) => {
  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });

  // admin/superadmin all=true bilan hammaning darslarini ko'radi
  const filter = STAFF_ROLES.includes(user.role) && all === 'true' ? {} : { createdBy: user._id };

  const term = typeof search === 'string' ? search.trim() : '';
  if (term) {
    filter.title = { $regex: term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }

  const gradeNum = Number(grade);
  if (grade !== undefined && grade !== '' && Number.isInteger(gradeNum)) filter.grade = gradeNum;

  const [lessons, total] = await Promise.all([
    BoardLesson.aggregate([
      { $match: filter },
      { $sort: { updatedAt: -1 } },
      { $skip: skip },
      { $limit: pageLimit },
      {
        // slides/exercises massivlari ro'yxatda qaytarilmaydi — faqat soni
        $project: {
          title: 1,
          subject: 1,
          grade: 1,
          theme: 1,
          updatedAt: 1,
          slideCount: { $size: '$slides' },
          exerciseCount: { $size: '$exercises' },
          coverImage: {
            $ifNull: [
              {
                $first: {
                  $filter: { input: '$slides.image', as: 'img', cond: { $gt: ['$$img', null] } },
                },
              },
              null,
            ],
          },
        },
      },
    ]),
    BoardLesson.countDocuments(filter),
  ]);

  return { lessons, meta: buildMeta(total, currentPage, pageLimit) };
};

const getLessonById = async (id, user) => toLessonResponse(await findManageable(id, user));

// slides/exercises to'liq almashtiriladi (frontend muharriri butun darsni yuboradi)
const updateLesson = async (id, user, body) => {
  const lesson = await findManageable(id, user);
  lesson.set(pickFields(body));
  await lesson.save();
  return toLessonResponse(lesson);
};

// Yuklangan rasmlar o'chirilmaydi — nusxalar ham shu fayllarga havola qilishi mumkin
const deleteLesson = async (id, user) => {
  const lesson = await findManageable(id, user);
  await lesson.deleteOne();
};

// Ko'rish huquqi bor istalgan darsdan joriy foydalanuvchi uchun mustaqil nusxa
const duplicateLesson = async (id, user) => {
  const source = await findManageable(id, user);
  const { title, description, subject, grade, theme, slides, exercises } = source.toObject();

  const stripId = ({ _id, ...rest }) => rest;
  const baseTitle = title.slice(0, TITLE_MAX - COPY_SUFFIX.length).trimEnd();

  const copy = await BoardLesson.create({
    title: `${baseTitle}${COPY_SUFFIX}`,
    description,
    subject,
    grade,
    theme,
    slides: slides.map(stripId),
    exercises: exercises.map(stripId),
    createdBy: user._id,
  });
  return toLessonResponse(copy);
};

module.exports = {
  createLesson,
  getLessons,
  getLessonById,
  updateLesson,
  deleteLesson,
  duplicateLesson,
};
