// src/modules/daily-spin/dailySpin.service.js

const DailySpin = require('./dailySpin.model');
const User = require('../users/user.model');
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

// Kun almashganda streak va kunlik limitni yangilaydi (in-memory — hali saqlanmagan)
const rollOverIfNewDay = (user, today) => {
  if (user.lastSpinDate === today) return;

  const yesterday = getTashkentDateString(-1);
  user.streakCount = user.lastSpinDate === yesterday ? user.streakCount + 1 : 1;
  user.lastSpinDate = today;
  user.spinsUsedToday = 0;
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

// POST /daily-spin/spin — barabonni aylantirish
const spin = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'Foydalanuvchi topilmadi');

  const today = getTashkentDateString();
  const maxSpins = getMaxSpins(user.tarif);

  rollOverIfNewDay(user, today);

  if (user.spinsUsedToday >= maxSpins) {
    throw new ApiError(
      400,
      `Bugun uchun aylantirish limitingiz tugadi (${maxSpins} marta)${
        user.tarif !== 'premium' ? " — ko'proq aylantirish uchun premium tarifga o'ting" : ''
      }`
    );
  }

  const prize = SPIN_PRIZE_TABLE[Math.floor(Math.random() * SPIN_PRIZE_TABLE.length)];

  user.spinsUsedToday += 1;
  user.diamonds += prize;
  await user.save();

  await DailySpin.create({
    user: userId,
    date: today,
    diamondsWon: prize,
    streakAtSpin: user.streakCount,
  });

  await notificationService.createNotification({
    userId,
    type: 'reward',
    title: "🎰 Kunlik barabon!",
    message: `🎡 Barabanni aylantirdingiz\n💎 Yutuq: ${prize} diamond\n🔥 Ketma-ket kunlar: ${user.streakCount}`,
    meta: { diamondsWon: prize, streakCount: user.streakCount },
    url: frontendLinks.dailySpin(),
    buttonText: '🎰 Yana aylantirish',
  });

  return {
    diamondsWon: prize,
    streakCount: user.streakCount,
    spinsUsedToday: user.spinsUsedToday,
    spinsRemainingToday: maxSpins - user.spinsUsedToday,
    maxSpinsToday: maxSpins,
  };
};

module.exports = { getStatus, spin };
