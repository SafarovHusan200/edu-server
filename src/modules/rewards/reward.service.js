// src/modules/rewards/reward.service.js

const Reward = require('./reward.model');
const RewardRedemption = require('./redemption.model');
const User = require('../users/user.model');
const notificationService = require('../notifications/notification.service');
const ApiError = require('../../utils/ApiError');
const { getPagination, buildMeta } = require('../../utils/paginate');

const createReward = async ({ title, description, cost, stock }) => {
  return Reward.create({ title, description, cost, stock: stock ?? null });
};

const getRewards = async ({ page, limit }) => {
  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });
  const filter = { isActive: true };

  const [rewards, total] = await Promise.all([
    Reward.find(filter).sort({ cost: 1 }).skip(skip).limit(pageLimit),
    Reward.countDocuments(filter),
  ]);

  return { rewards, meta: buildMeta(total, currentPage, pageLimit) };
};

const getRewardById = async (id) => {
  const reward = await Reward.findById(id);
  if (!reward) throw new ApiError(404, "Sovg'a topilmadi");
  return reward;
};

const updateReward = async (id, updateData) => {
  const reward = await Reward.findById(id);
  if (!reward) throw new ApiError(404, "Sovg'a topilmadi");

  Object.assign(reward, updateData);
  await reward.save();
  return reward;
};

const setImage = async (id, publicPath) => {
  const reward = await Reward.findById(id);
  if (!reward) throw new ApiError(404, "Sovg'a topilmadi");

  reward.image = publicPath;
  await reward.save();
  return reward;
};

const deleteReward = async (id) => {
  const reward = await Reward.findById(id);
  if (!reward) throw new ApiError(404, "Sovg'a topilmadi");

  const pendingCount = await RewardRedemption.countDocuments({ reward: id, status: 'pending' });
  if (pendingCount > 0) {
    throw new ApiError(400, "Bu sovg'a bo'yicha kutilayotgan so'rovlar bor, avval ularni yakunlang");
  }

  await reward.deleteOne();
};

// POST /rewards/:id/redeem — diamant atomik yechiladi (race condition yo'q)
const redeemReward = async (studentId, rewardId) => {
  const reward = await Reward.findById(rewardId);
  if (!reward || !reward.isActive) throw new ApiError(404, "Sovg'a topilmadi");

  if (reward.stock !== null && reward.stock <= 0) {
    throw new ApiError(400, "Bu sovg'a tugagan");
  }

  const updatedUser = await User.findOneAndUpdate(
    { _id: studentId, diamonds: { $gte: reward.cost } },
    { $inc: { diamonds: -reward.cost } },
    { returnDocument: 'after' }
  );

  if (!updatedUser) {
    throw new ApiError(400, 'Diamantlaringiz yetarli emas');
  }

  if (reward.stock !== null) {
    await Reward.findByIdAndUpdate(rewardId, { $inc: { stock: -1 } });
  }

  const redemption = await RewardRedemption.create({
    student: studentId,
    reward: rewardId,
    diamondsSpent: reward.cost,
  });

  await notificationService.createNotification({
    userId: studentId,
    type: 'reward',
    title: "Sovg'a so'rovi yuborildi",
    message: `"${reward.title}" sovg'asi uchun ${reward.cost} diamant sarflandi. Admin tasdig'ini kuting`,
    meta: { rewardId: reward._id, redemptionId: redemption._id },
  });

  return redemption;
};

const getMyRedemptions = async (studentId, { page, limit }) => {
  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });
  const filter = { student: studentId };

  const [redemptions, total] = await Promise.all([
    RewardRedemption.find(filter)
      .populate('reward', 'title image cost')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageLimit),
    RewardRedemption.countDocuments(filter),
  ]);

  return { redemptions, meta: buildMeta(total, currentPage, pageLimit) };
};

const getAllRedemptions = async ({ page, limit, status }) => {
  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });
  const filter = {};
  if (status) filter.status = status;

  const [redemptions, total] = await Promise.all([
    RewardRedemption.find(filter)
      .populate('reward', 'title image cost')
      .populate('student', 'name phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageLimit),
    RewardRedemption.countDocuments(filter),
  ]);

  return { redemptions, meta: buildMeta(total, currentPage, pageLimit) };
};

// PATCH /rewards/redemptions/:id — admin: 'delivered' yoki 'rejected'
const updateRedemptionStatus = async (redemptionId, { status, adminNote }) => {
  const redemption = await RewardRedemption.findById(redemptionId);
  if (!redemption) throw new ApiError(404, "So'rov topilmadi");

  if (redemption.status !== 'pending') {
    throw new ApiError(400, "Bu so'rov allaqachon yakunlangan");
  }

  redemption.status = status;
  redemption.adminNote = adminNote ?? redemption.adminNote;
  await redemption.save();

  if (status === 'rejected') {
    await User.findByIdAndUpdate(redemption.student, {
      $inc: { diamonds: redemption.diamondsSpent },
    });

    const reward = await Reward.findById(redemption.reward);
    if (reward && reward.stock !== null) {
      await Reward.findByIdAndUpdate(redemption.reward, { $inc: { stock: 1 } });
    }
  }

  await notificationService.createNotification({
    userId: redemption.student,
    type: 'reward',
    title: status === 'delivered' ? "Sovg'angiz yetkazildi" : "So'rovingiz rad etildi",
    message:
      status === 'delivered'
        ? "Sovg'a so'rovingiz tasdiqlandi va yetkazildi"
        : `So'rovingiz rad etildi, diamantlaringiz qaytarildi${adminNote ? `: ${adminNote}` : ''}`,
    meta: { redemptionId: redemption._id },
  });

  return redemption;
};

module.exports = {
  createReward,
  getRewards,
  getRewardById,
  updateReward,
  setImage,
  deleteReward,
  redeemReward,
  getMyRedemptions,
  getAllRedemptions,
  updateRedemptionStatus,
};
