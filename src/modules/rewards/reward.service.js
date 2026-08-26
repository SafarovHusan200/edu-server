// src/modules/rewards/reward.service.js

const Reward = require('./reward.model');
const RewardRedemption = require('./redemption.model');
const User = require('../users/user.model');
const notificationService = require('../notifications/notification.service');
const ApiError = require('../../utils/ApiError');
const { getPagination, buildMeta } = require('../../utils/paginate');

const createReward = async ({ title, description, cost, stock, premiumOnly }) => {
  return Reward.create({
    title,
    description,
    cost,
    stock: stock ?? null,
    premiumOnly: premiumOnly ?? false,
  });
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

  const pendingCount = await RewardRedemption.countDocuments({
    reward: id,
    status: { $in: ['pending', 'approved'] },
  });
  if (pendingCount > 0) {
    throw new ApiError(
      400,
      "Bu sovg'a bo'yicha kutilayotgan so'rovlar bor, avval ularni yakunlang"
    );
  }

  await reward.deleteOne();
};

// POST /rewards/:id/redeem — diamond atomik yechiladi (race condition yo'q)
const redeemReward = async (studentId, rewardId) => {
  const reward = await Reward.findById(rewardId);
  if (!reward || !reward.isActive) throw new ApiError(404, "Sovg'a topilmadi");

  if (reward.stock !== null && reward.stock <= 0) {
    throw new ApiError(400, "Bu sovg'a tugagan");
  }

  if (reward.premiumOnly) {
    const student = await User.findById(studentId).select('tarif');
    if (student?.tarif !== 'premium') {
      throw new ApiError(403, "Bu sovg'a faqat premium foydalanuvchilar uchun mo'ljallangan");
    }
  }

  const updatedUser = await User.findOneAndUpdate(
    { _id: studentId, diamonds: { $gte: reward.cost } },
    { $inc: { diamonds: -reward.cost } },
    { returnDocument: 'after' }
  );

  if (!updatedUser) {
    throw new ApiError(400, 'Diamondlaringiz yetarli emas');
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
    title: "🎁 Sovg'a so'rovi yuborildi",
    message: `🎁 Sovg'a: "${reward.title}"\n💎 Sarflangan diamond: ${reward.cost}\n⏳ Holat: admin tasdig'ini kutmoqda`,
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
      .populate('approvedBy', 'name phone')
      .populate('rejectedBy', 'name phone')
      .populate('deliveredBy', 'name phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageLimit),
    RewardRedemption.countDocuments(filter),
  ]);

  return { redemptions, meta: buildMeta(total, currentPage, pageLimit) };
};

// PATCH /rewards/redemptions/:id/approve — admin: bosqich 1, so'rovni ko'rib chiqib tasdiqlaydi
// (mukofot hali qo'lga topshirilmagan — haftalik/oylik yetkazish navbatiga qo'yiladi)
const approveRedemption = async (redemptionId, adminId) => {
  const redemption = await RewardRedemption.findById(redemptionId);
  if (!redemption) throw new ApiError(404, "So'rov topilmadi");

  if (redemption.status !== 'pending') {
    throw new ApiError(400, "Bu so'rov ko'rib chiqish bosqichida emas");
  }

  redemption.status = 'approved';
  redemption.approvedBy = adminId;
  redemption.approvedAt = new Date();
  await redemption.save();

  const reward = await Reward.findById(redemption.reward).select('title');

  await notificationService.createNotification({
    userId: redemption.student,
    type: 'reward',
    title: "Tabriklaymiz, so'rovingiz tasdiqlandi✅",
    message: `🎁 Sovg'a: "${reward?.title ?? "Noma'lum sovg'a"}"\n So'rovingiz admin tomonidan tasdiqlandi, yetkazib berilishini kuting`,
    meta: { redemptionId: redemption._id },
  });

  return redemption;
};

// PATCH /rewards/redemptions/:id/reject — admin: pending yoki approved holatidan rad etadi,
// diamond va (agar cheklangan bo'lsa) stock studentga/omborga qaytariladi
const rejectRedemption = async (redemptionId, adminId, reason) => {
  const redemption = await RewardRedemption.findById(redemptionId);
  if (!redemption) throw new ApiError(404, "So'rov topilmadi");

  if (!['pending', 'approved'].includes(redemption.status)) {
    throw new ApiError(400, "Bu so'rovni endi rad etib bo'lmaydi");
  }

  redemption.status = 'rejected';
  redemption.rejectedBy = adminId;
  redemption.rejectedAt = new Date();
  redemption.rejectReason = reason ?? '';
  await redemption.save();

  await User.findByIdAndUpdate(redemption.student, {
    $inc: { diamonds: redemption.diamondsSpent },
  });

  const reward = await Reward.findById(redemption.reward).select('title stock');
  if (reward && reward.stock !== null) {
    await Reward.findByIdAndUpdate(redemption.reward, { $inc: { stock: 1 } });
  }

  await notificationService.createNotification({
    userId: redemption.student,
    type: 'reward',
    title: "❌ So'rovingiz rad etildi",
    message: `🎁 Sovg'a: "${reward?.title ?? "Noma'lum sovg'a"}"\n💎 ${redemption.diamondsSpent} diamond hisobingizga qaytarildi${reason ? `\n📝 Sabab: ${reason}` : ''}`,
    meta: { redemptionId: redemption._id },
  });

  return redemption;
};

// PATCH /rewards/redemptions/:id/deliver — admin: bosqich 2 (yakuniy), faqat 'approved'
// holatidan — mukofot studentga jismonan topshirilgandan so'ng chaqiriladi
const deliverRedemption = async (redemptionId, adminId, note) => {
  const redemption = await RewardRedemption.findById(redemptionId);
  if (!redemption) throw new ApiError(404, "So'rov topilmadi");

  if (redemption.status !== 'approved') {
    throw new ApiError(400, "Avval so'rov tasdiqlangan (approved) bo'lishi kerak");
  }

  redemption.status = 'delivered';
  redemption.deliveredBy = adminId;
  redemption.deliveredAt = new Date();
  redemption.deliveryNote = note ?? '';
  await redemption.save();

  const reward = await Reward.findById(redemption.reward).select('title');

  await notificationService.createNotification({
    userId: redemption.student,
    type: 'reward',
    title: "📦 Sovg'angiz yetkazildi!",
    message: `🎁 Sovg'a: "${reward?.title ?? "Noma'lum sovg'a"}"\n✅ Sizga topshirildi`,
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
  approveRedemption,
  rejectRedemption,
  deliverRedemption,
};
