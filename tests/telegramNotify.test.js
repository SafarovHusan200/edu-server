jest.mock('../src/bot/telegramNotifier');

const { sendTelegramMessage } = require('../src/bot/telegramNotifier');
const notificationService = require('../src/modules/notifications/notification.service');
const { createUser } = require('./helpers');

describe('Notification -> Telegram wiring', () => {
  beforeEach(() => {
    sendTelegramMessage.mockClear();
    sendTelegramMessage.mockResolvedValue(undefined);
  });

  test('telegramId bor userga bildirishnoma yaratilsa Telegram xabar ham yuboriladi', async () => {
    const { user } = await createUser({ role: 'student', telegramId: 555111222 });

    await notificationService.createNotification({
      userId: user._id,
      type: 'system',
      title: 'Sarlavha',
      message: 'Matn',
    });

    expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
    expect(sendTelegramMessage).toHaveBeenCalledWith(555111222, expect.stringContaining('Sarlavha'));
    expect(sendTelegramMessage).toHaveBeenCalledWith(555111222, expect.stringContaining('Matn'));
  });

  test('telegramId yo\'q userga bildirishnoma yaratilsa Telegram xabar yuborilmaydi', async () => {
    const { user } = await createUser({ role: 'student' });

    await notificationService.createNotification({
      userId: user._id,
      type: 'system',
      title: 'Sarlavha',
      message: 'Matn',
    });

    expect(sendTelegramMessage).not.toHaveBeenCalled();
  });
});
