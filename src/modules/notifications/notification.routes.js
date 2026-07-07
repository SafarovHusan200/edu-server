// src/modules/notifications/notification.routes.js

const express = require('express');
const router = express.Router();

const notificationController = require('./notification.controller');
const authenticate = require('../../middleware/authenticate');

router.use(authenticate);

// GET /api/v1/notifications
router.get('/', notificationController.getMyNotifications);

// PATCH /api/v1/notifications/read-all
router.patch('/read-all', notificationController.markAllAsRead);

// PATCH /api/v1/notifications/:id/read
router.patch('/:id/read', notificationController.markAsRead);

// DELETE /api/v1/notifications/:id
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
