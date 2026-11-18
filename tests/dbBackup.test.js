const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

// Scheduler TELEGRAM_CHAT_ID'ni config yuklanganda o'qiydi — require'dan OLDIN
process.env.DB_BACKUP_TELEGRAM_CHAT_ID = '123456';

jest.mock('../src/bot/bot', () => ({ sendDocument: jest.fn(), sendMessage: jest.fn() }));
// restoreBackup.js dotenv'ni chaqiradi — test muhitiga haqiqiy .env aralashmasin
jest.mock('dotenv', () => ({ config: () => ({}) }));

const bot = require('../src/bot/bot');
const { createBackupBuffer } = require('../src/jobs/dbBackup.service');
const { runBackupAndSend, splitBuffer } = require('../src/jobs/dbBackup.scheduler');
const { readBackupFiles } = require('../scripts/restoreBackup');
const { createUser } = require('./helpers');

let consoleSpies;
beforeEach(() => {
  bot.sendDocument.mockReset().mockResolvedValue({});
  bot.sendMessage.mockReset().mockResolvedValue({});
  consoleSpies = [jest.spyOn(console, 'log').mockImplementation(() => {}), jest.spyOn(console, 'error').mockImplementation(() => {})];
});
afterEach(() => consoleSpies.forEach((s) => s.mockRestore()));

describe('DB Backup', () => {
  test('createBackupBuffer barcha kolleksiyalarni eksport qiladi va parolni chiqarib tashlaydi', async () => {
    await createUser({ role: 'student', name: 'Zaxira Testi' });

    const { buffer, sizeBytes, collectionCount, documentCount } = await createBackupBuffer();

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(sizeBytes).toBeGreaterThan(0);
    expect(collectionCount).toBeGreaterThan(0);
    expect(documentCount).toBeGreaterThan(0);

    const json = zlib.gunzipSync(buffer).toString('utf-8');
    const parsed = JSON.parse(json);

    expect(parsed.exportedAt).toBeDefined();
    expect(parsed.collections.users.length).toBeGreaterThan(0);

    const exportedUser = parsed.collections.users.find((u) => u.name === 'Zaxira Testi');
    expect(exportedUser).toBeDefined();
    expect(exportedUser.password).toBeUndefined();
    expect(exportedUser.phone).toBeDefined();
  });

  test('kichik zaxira bitta fayl bo\'lib, ogohlantirishsiz yuboriladi', async () => {
    await createUser({ role: 'student' });

    await runBackupAndSend();

    expect(bot.sendDocument).toHaveBeenCalledTimes(1);
    const [chatId, , options, fileOptions] = bot.sendDocument.mock.calls[0];
    expect(chatId).toBe('123456');
    expect(fileOptions.filename).toMatch(/^backup-\d{4}-\d{2}-\d{2}\.json\.gz$/);
    expect(options.caption).toMatch(/Tiklash uchun: <code>node scripts\/restoreBackup\.js backup-.+\.json\.gz --yes<\/code>/);
    expect(options.caption).not.toMatch(/Zaxira hajmi katta|Bo'lak/);
    expect(bot.sendMessage).not.toHaveBeenCalled();
  });

  test("limitdan katta zaxira bo'laklarga bo'linadi, bo'laklar birlashtirilganda asl faylga teng", async () => {
    for (let i = 0; i < 5; i += 1) await createUser({ role: 'student', name: `Bo'lak testi ${i}` });

    await runBackupAndSend({ partSize: 200, warnSize: 100 });

    const calls = bot.sendDocument.mock.calls;
    const total = calls.length;
    expect(total).toBeGreaterThan(1);

    calls.forEach(([, buffer, options, fileOptions], i) => {
      expect(buffer.length).toBeLessThanOrEqual(200);
      expect(fileOptions.filename).toMatch(new RegExp(`\\.json\\.gz\\.part${i + 1}-of-${total}$`));
      expect(options.caption).toContain(`Bo'lak ${i + 1}/${total}`);
    });
    // Ogohlantirish va tiklash yo'riqnomasi birinchi bo'lakda
    expect(calls[0][2].caption).toMatch(/Zaxira hajmi katta/);
    expect(calls[0][2].caption).toMatch(new RegExp(`${total} ta bo'lakni bitta papkaga saqlang`));

    // Bo'laklarni diskka yozib, restore skripti orqali o'qiymiz
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
    try {
      const files = calls.map(([, buffer, , { filename }]) => {
        const file = path.join(dir, filename);
        fs.writeFileSync(file, buffer);
        return file;
      });
      const baseName = files[0].replace(/\.part\d+-of-\d+$/, '');

      // 1) Faqat asosiy nom berilsa — bo'laklar o'zi topiladi
      const byBase = readBackupFiles([baseName]);
      const parsed = JSON.parse(zlib.gunzipSync(byBase.buffer).toString('utf-8'));
      expect(parsed.collections.users.some((u) => u.name === "Bo'lak testi 4")).toBe(true);

      // 2) Aralash tartibda berilsa ham to'g'ri birlashadi
      const shuffled = readBackupFiles([...files].reverse());
      expect(shuffled.buffer.equals(byBase.buffer)).toBe(true);

      // 3) Bo'lak yetishmasa — xato
      expect(() => readBackupFiles(files.slice(1))).toThrow(/to'liq emas/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('splitBuffer limitdan oshmaydigan bo\'laklarga ajratadi', () => {
    const parts = splitBuffer(Buffer.alloc(1001), 250);
    expect(parts.map((p) => p.length)).toEqual([250, 250, 250, 250, 1]);
  });

  test("yuborishda xato bo'lsa — shu chatga ❌ xabari yuboriladi (HTML escape bilan)", async () => {
    bot.sendDocument.mockRejectedValue(new Error('ETELEGRAM: 413 Request Entity Too Large <file>'));

    await runBackupAndSend();

    expect(bot.sendMessage).toHaveBeenCalledTimes(1);
    const [chatId, text, options] = bot.sendMessage.mock.calls[0];
    expect(chatId).toBe('123456');
    expect(text).toMatch(/❌ <b>Kunlik DB zaxirasi yuborilmadi<\/b>/);
    expect(text).toContain('413 Request Entity Too Large &lt;file&gt;');
    expect(options).toEqual({ parse_mode: 'HTML' });
  });

  test('xato xabarini ham yuborib bo\'lmasa — server yiqilmaydi', async () => {
    bot.sendDocument.mockRejectedValue(new Error('tarmoq yo\'q'));
    bot.sendMessage.mockRejectedValue(new Error('tarmoq yo\'q'));

    await expect(runBackupAndSend()).resolves.toBeUndefined();
  });
});
