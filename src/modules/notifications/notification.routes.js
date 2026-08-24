// src/modules/notifications/notification.routes.js

const express = require('express');
const router = express.Router();

const notificationController = require('./notification.controller');
const authenticate = require('../../middleware/authenticate');

router.use(authenticate);

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: O'zining bildirishnomalarini olish
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Bildirishnomalar ro'yxati
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Notification' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// GET /api/v1/notifications
router.get('/', notificationController.getMyNotifications);

/**
 * @swagger
 * /notifications/read-all:
 *   patch:
 *     summary: Barcha bildirishnomalarni o'qilgan deb belgilash
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Barchasi o'qilgan deb belgilandi
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// PATCH /api/v1/notifications/read-all
router.patch('/read-all', notificationController.markAllAsRead);

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Bitta bildirishnomani o'qilgan deb belgilash
 *     tags: [Notifications]
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       200:
 *         description: O'qilgan deb belgilandi
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data: { $ref: '#/components/schemas/Notification' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// PATCH /api/v1/notifications/:id/read
router.patch('/:id/read', notificationController.markAsRead);

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: Bildirishnomani o'chirish
 *     tags: [Notifications]
 *     parameters:
 *       - { $ref: '#/components/parameters/IdParam' }
 *     responses:
 *       200:
 *         description: O'chirildi
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
// DELETE /api/v1/notifications/:id
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
