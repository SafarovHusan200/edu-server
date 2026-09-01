// src/modules/notifications/notification.service.js
// Boshqa modullar (payment, enrollment, quiz-attempts) shu servisdan foydalanib
// foydalanuvchiga tizim ichi bildirishnoma yaratadi. Public POST endpoint yo'q.

const Notification = require('./notification.model');
const User = require('../users/user.model');
const { sendTelegramMessage } = require('../../bot/telegramNotifier');
const ApiError = require('../../utils/ApiError');
const { getPagination, buildMeta } = require('../../utils/paginate');

// url/buttonText berilsa — Telegram xabari ostiga "ochish" (sayt) tugmasi qo'shiladi,
// va shu havola notification.meta.url'ga ham yoziladi (frontend in-app bildirishnomada
// deep-link sifatida ishlatishi mumkin). callbackData/callbackButtonText berilsa —
// botning o'zida amal boshlaydigan qo'shimcha tugma qo'shiladi (masalan "Botda
// tekshirish" — bot.js'dagi callback_query handler shu data'ni ushlab oladi).
const createNotification = async ({
  userId,
  type,
  title,
  message,
  meta = {},
  url,
  buttonText,
  callbackData,
  callbackButtonText,
}) => {
  const fullMeta = url ? { ...meta, url } : meta;
  const notification = await Notification.create({ user: userId, type, title, message, meta: fullMeta });

  const user = await User.findById(userId).select('telegramId');
  if (user?.telegramId) {
    // Fire-and-forget — Telegram sekin/ishlamasa ham asosiy oqim kutib turmaydi
    const text = `<b>${title}</b>\n${message}`;
    if (url || callbackData) {
      sendTelegramMessage(user.telegramId, text, { url, buttonText, callbackData, callbackButtonText });
    } else {
      sendTelegramMessage(user.telegramId, text);
    }
  }

  return notification;
};

const getMyNotifications = async (userId, { page, limit }) => {
  const { skip, limit: pageLimit, page: currentPage } = getPagination({ page, limit });

  const filter = { user: userId };

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageLimit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...filter, isRead: false }),
  ]);

  return { notifications, unreadCount, meta: buildMeta(total, currentPage, pageLimit) };
};

const markAsRead = async (notificationId, userId) => {
  const notification = await Notification.findById(notificationId);
  if (!notification) throw new ApiError(404, 'Bildirishnoma topilmadi');

  if (notification.user.toString() !== userId.toString()) {
    throw new ApiError(403, 'Bu bildirishnoma sizniki emas');
  }

  notification.isRead = true;
  await notification.save();
  return notification;
};

const markAllAsRead = async (userId) => {
  await Notification.updateMany({ user: userId, isRead: false }, { isRead: true });
};

const deleteNotification = async (notificationId, userId) => {
  const notification = await Notification.findById(notificationId);
  if (!notification) throw new ApiError(404, 'Bildirishnoma topilmadi');

  if (notification.user.toString() !== userId.toString()) {
    throw new ApiError(403, 'Bu bildirishnoma sizniki emas');
  }

  await notification.deleteOne();
};

module.exports = {
  createNotification,
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
