const zlib = require('zlib');
const { createBackupBuffer } = require('../src/jobs/dbBackup.service');
const { createUser } = require('./helpers');

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
});
