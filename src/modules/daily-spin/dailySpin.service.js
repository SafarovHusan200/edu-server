// src/modules/daily-spin/dailySpin.service.js

const DailySpin = require('./dailySpin.model');
const User = require('../users/user.model');
const SpinQuestion = require('../spin-questions/spinQuestion.model');
const spinQuestionService = require('../spin-questions/spinQuestion.service');
const notificationService = require('../notifications/notification.service');
const ApiError = require('../../utils/ApiError');
const { getTashkentDateString } = require('../../utils/tashkentDate');
const {
  STANDARD_SPINS_PER_DAY,
  PREMIUM_SPINS_PER_DAY,
  SPIN_PRIZE_TABLE,
} = require('../../config/gamification');
const { frontendLinks } = require('../../config/frontendLinks');

const getMaxSpins = (tarif) => (tarif === 'premium' ? PREMIUM_SPINS_PER_DAY : STANDARD_SPINS_PER_DAY);

// Savol chiqqandan keyin javob berish uchun ajratilgan vaqt — shundan keyin savol
// "yondi" deb hisoblanadi (aylantirish allaqachon ishlatilgan bo'lib qoladi)
const PENDING_ANSWER_WINDOW_MS = 5 * 60 * 1000;

// Kun almashganda streak va kunlik limitni yangilaydi (in-memory — hali saqlanmagan)
const rollOverIfNewDay = (user, today) => {
  if (user.lastSpinDate === today) return;

  const yesterday = getTashkentDateString(-1);
  user.streakCount = user.lastSpinDate === yesterday ? user.streakCount + 1 : 1;
  user.lastSpinDate = today;
  user.spinsUsedToday = 0;
};

const clearPendingSpin = (user) => {
  user.pendingSpinQuestion = null;
  user.pendingSpinExpiresAt = null;
};

// GET /daily-spin/status — aylantirishdan oldin holatni ko'rish uchun
const getStatus = async (userId) => {
  const user = await User.findById(userId).select('tarif streakCount lastSpinDate spinsUsedToday');
  if (!user) throw new ApiError(404, 'Foydalanuvchi topilmadi');

  const today = getTashkentDateString();
  const yesterday = getTashkentDateString(-1);
  const maxSpins = getMaxSpins(user.tarif);
  const spinsUsedToday = user.lastSpinDate === today ? user.spinsUsedToday : 0;

  // Streak hali bazada yangilanmagan (faqat spin vaqtida yoziladi) — shuning uchun
  // bu yerda faqat ko'rsatish uchun hisoblanadi: kecha yoki bugun aylantirilgan bo'lsa
  // streak hali "tirik", aks holda uzilgan (0 sifatida ko'rsatiladi)
  const streakCount =
    user.lastSpinDate === today || user.lastSpinDate === yesterday ? user.streakCount : 0;

  return {
    streakCount,
    maxSpinsToday: maxSpins,
    spinsUsedToday,
    spinsRemainingToday: maxSpins - spinsUsedToday,
    canSpin: spinsUsedToday < maxSpins,
  };
};

// POST /daily-spin/spin — barabonni aylantirish: diamond DARHOL berilmaydi, buning
// o'rniga foydalanuvchining sinfiga mos savol chiqadi (2026-11-02'dan). Diamond faqat
// POST /daily-spin/answer orqali TO'G'RI javob berilgandagina beriladi. Aylantirish shu
// zahoti ishlatilgan hisoblanadi — javob to'g'ri/noto'g'ri bo'lishidan qat'i nazar.
const spin = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'Foydalanuvchi topilmadi');

  const today = getTashkentDateString();
  const maxSpins = getMaxSpins(user.tarif);

  rollOverIfNewDay(user, today);

  if (user.pendingSpinQuestion && user.pendingSpinExpiresAt && user.pendingSpinExpiresAt > new Date()) {
    throw new ApiError(400, "Avval oldingi savolga javob bering");
  }

  if (user.spinsUsedToday >= maxSpins) {
    throw new ApiError(
      400,
      `Bugun uchun aylantirish limitingiz tugadi (${maxSpins} marta)${
        user.tarif !== 'premium' ? " — ko'proq aylantirish uchun premium tarifga o'ting" : ''
      }`
    );
  }

  const question = await spinQuestionService.getRandomSpinQuestion(user.grade?.number);
  if (!question) {
    throw new ApiError(
      400,
      "Sizning sinfingiz uchun hali savollar qo'shilmagan. Administratorga xabar bering"
    );
  }

  user.spinsUsedToday += 1;
  user.pendingSpinQuestion = question._id;
  user.pendingSpinExpiresAt = new Date(Date.now() + PENDING_ANSWER_WINDOW_MS);
  await user.save();

  return {
    question: {
      _id: question._id,
      question: question.question,
      options: question.options,
    },
    answerWithinMinutes: PENDING_ANSWER_WINDOW_MS / 60000,
    streakCount: user.streakCount,
    spinsUsedToday: user.spinsUsedToday,
    spinsRemainingToday: maxSpins - user.spinsUsedToday,
    maxSpinsToday: maxSpins,
  };
};

// POST /daily-spin/answer — barabon savoliga javob. To'g'ri bo'lsa tasodifiy diamond
// (SPIN_PRIZE_TABLE) beriladi, noto'g'ri bo'lsa 0 (aylantirish allaqachon ishlatilgan edi).
const answerSpin = async (userId, selectedIndex) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'Foydalanuvchi topilmadi');

  if (!user.pendingSpinQuestion) {
    throw new ApiError(400, 'Avval barabonni aylantiring');
  }

  const isExpired = !user.pendingSpinExpiresAt || user.pendingSpinExpiresAt < new Date();
  const questionId = user.pendingSpinQuestion;
  clearPendingSpin(user);

  if (isExpired) {
    await user.save();
    throw new ApiError(400, "Savolga javob berish muddati tugadi");
  }

  const question = await SpinQuestion.findById(questionId);
  const correct = Boolean(question) && question.correctIndex === selectedIndex;
  const prize = correct ? SPIN_PRIZE_TABLE[Math.floor(Math.random() * SPIN_PRIZE_TABLE.length)] : 0;

  if (correct) user.diamonds += prize;
  await user.save();

  await DailySpin.create({
    user: userId,
    date: getTashkentDateString(),
    diamondsWon: prize,
    streakAtSpin: user.streakCount,
    correct,
  });

  if (correct) {
    await notificationService.createNotification({
      userId,
      type: 'reward',
      title: '🎰 Kunlik barabon!',
      message: `🎡 Savolga to'g'ri javob berdingiz\n💎 Yutuq: ${prize} diamond\n🔥 Ketma-ket kunlar: ${user.streakCount}`,
      meta: { diamondsWon: prize, streakCount: user.streakCount },
      url: frontendLinks.dailySpin(),
      buttonText: '🎰 Yana aylantirish',
    });
  }

  const maxSpins = getMaxSpins(user.tarif);

  return {
    correct,
    diamondsWon: prize,
    correctIndex: question ? question.correctIndex : null,
    streakCount: user.streakCount,
    spinsUsedToday: user.spinsUsedToday,
    spinsRemainingToday: maxSpins - user.spinsUsedToday,
    maxSpinsToday: maxSpins,
  };
};

// GET /daily-spin/history — "So'nggi yutuqlar" ro'yxati uchun
const getHistory = async (userId, limit = 10) => {
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));

  return DailySpin.find({ user: userId })
    .select('diamondsWon correct createdAt')
    .sort({ createdAt: -1 })
    .limit(safeLimit);
};

module.exports = { getStatus, spin, answerSpin, getHistory };
