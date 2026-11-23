// src/migrations/rewardOrder.js
// Reward.order paydo bo'lishidan oldingi sovg'alarga boshlang'ich tartib: createdAt
// kamayish bo'yicha (yangisi oldinda) order = 0, 1, 2, ...
//
// Qayta ishga tushirish xavfsiz: biror sovg'ada order allaqachon 0 dan farqli bo'lsa
// (migratsiya qilingan yoki admin tartiblagan) — hech narsa o'zgartirilmaydi (force'siz).

const Reward = require('../modules/rewards/reward.model');

const migrateRewardOrder = async ({ dryRun = false, force = false } = {}) => {
  const alreadyOrdered = await Reward.countDocuments({ order: { $nin: [0, null] } });
  if (alreadyOrdered > 0 && !force) {
    return { skipped: true, alreadyOrdered, updated: 0, rewards: [] };
  }

  const rewards = await Reward.find().sort({ createdAt: -1 }).select('_id title').lean();

  if (!dryRun && rewards.length > 0) {
    await Reward.bulkWrite(
      rewards.map((r, i) => ({
        updateOne: { filter: { _id: r._id }, update: { $set: { order: i } } },
      }))
    );
  }

  return { skipped: false, alreadyOrdered, updated: dryRun ? 0 : rewards.length, rewards };
};

module.exports = { migrateRewardOrder };
