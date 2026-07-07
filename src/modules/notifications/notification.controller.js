// src/modules/notifications/notification.controller.js

const notificationService = require('./notification.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

// GET /api/v1/notifications
const getMyNotifications = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;

  const { notifications, unreadCount, meta } = await notificationService.getMyNotifications(
    req.user.id,
    { page, limit }
  );

  res
    .status(200)
    .json(new ApiResponse(200, 'Bildirishnomalar', { notifications, unreadCount, meta }));
});

// PATCH /api/v1/notifications/:id/read
const markAsRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markAsRead(req.params.id, req.user.id);

  res.status(200).json(new ApiResponse(200, "O'qilgan deb belgilandi", { notification }));
});

// PATCH /api/v1/notifications/read-all
const markAllAsRead = asyncHandler(async (req, res) => {
  await notificationService.markAllAsRead(req.user.id);

  res.status(200).json(new ApiResponse(200, "Barchasi o'qilgan deb belgilandi"));
});

// DELETE /api/v1/notifications/:id
const deleteNotification = asyncHandler(async (req, res) => {
  await notificationService.deleteNotification(req.params.id, req.user.id);

  res.status(200).json(new ApiResponse(200, "Bildirishnoma o'chirildi"));
});

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
