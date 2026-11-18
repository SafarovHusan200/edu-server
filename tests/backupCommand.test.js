const { createBackupHandler } = require('../src/bot/backupCommand');

const CHAT_ID = '123456';
const msgFrom = (chatId, userId = 1) => ({ chat: { id: Number(chatId) }, from: { id: userId, username: 'admin' } });

let bot;
let runBackup;
let clock;
let handler;
let consoleSpies;

beforeEach(() => {
  bot = { sendMessage: jest.fn().mockResolvedValue({}) };
  runBackup = jest.fn().mockResolvedValue(undefined);
  clock = 1_000_000;
  handler = createBackupHandler({ bot, chatId: CHAT_ID, runBackup, now: () => clock, cooldownMs: 10 * 60 * 1000 });
  consoleSpies = ['log', 'warn', 'error'].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
});
afterEach(() => consoleSpies.forEach((s) => s.mockRestore()));

describe('/backup buyrug\'i', () => {
  test('ruxsat etilgan chatdan — zaxira yuboriladi', async () => {
    await handler(msgFrom(CHAT_ID));

    expect(runBackup).toHaveBeenCalledTimes(1);
    expect(bot.sendMessage).toHaveBeenCalledWith(CHAT_ID, '⏳ Zaxira tayyorlanmoqda...');
  });

  test("boshqa chatdan — \"Noma'lum buyruq\", zaxira olinmaydi va borligi oshkor qilinmaydi", async () => {
    await handler(msgFrom('999', 999));

    expect(runBackup).not.toHaveBeenCalled();
    expect(bot.sendMessage).toHaveBeenCalledWith('999', "Noma'lum buyruq.");
    expect(JSON.stringify(bot.sendMessage.mock.calls)).not.toMatch(/zaxira/i);
  });

  test("chat ID sozlanmagan bo'lsa hech kimga ishlamaydi", async () => {
    const h = createBackupHandler({ bot, chatId: null, runBackup });
    await h(msgFrom(CHAT_ID));
    expect(runBackup).not.toHaveBeenCalled();
  });

  test('10 daqiqa ichida qayta chaqirilsa — rad etiladi, qolgan vaqt aytiladi; keyin yana ishlaydi', async () => {
    await handler(msgFrom(CHAT_ID));

    clock += 3 * 60 * 1000;
    await handler(msgFrom(CHAT_ID));
    expect(runBackup).toHaveBeenCalledTimes(1);
    expect(bot.sendMessage).toHaveBeenLastCalledWith(CHAT_ID, "⏳ Keyingi zaxirani 7 daqiqadan so'ng olish mumkin.");

    clock += 7 * 60 * 1000;
    await handler(msgFrom(CHAT_ID));
    expect(runBackup).toHaveBeenCalledTimes(2);
  });

  test('zaxira tayyorlanayotganda ikkinchi chaqiruv parallel ishga tushmaydi', async () => {
    let finish;
    runBackup.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));

    const first = handler(msgFrom(CHAT_ID));
    await handler(msgFrom(CHAT_ID));
    expect(bot.sendMessage).toHaveBeenLastCalledWith(CHAT_ID, '⏳ Zaxira hozir tayyorlanmoqda, biroz kuting.');

    finish();
    await first;
    expect(runBackup).toHaveBeenCalledTimes(1);
  });
});
