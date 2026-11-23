const mongoose = require('mongoose');
const Reward = require('../src/modules/rewards/reward.model');
const { migrateRewardOrder } = require('../src/migrations/rewardOrder');

describe('Migratsiyalar (deploy har safar ishga tushiradi — idempotent bo\'lishi shart)', () => {
  test('reward-order: eski sovg\'alarga createdAt bo\'yicha tartib, qayta ishga tushirish hech narsani buzmaydi', async () => {
    // order maydonisiz eski yozuvlar (sxemadan tashqarida)
    const now = Date.now();
    await mongoose.connection.collection('rewards').insertMany([
      { title: 'Eski', cost: 1, isActive: true, createdAt: new Date(now - 3000) },
      { title: "O'rta", cost: 1, isActive: true, createdAt: new Date(now - 2000) },
      { title: 'Yangi', cost: 1, isActive: true, createdAt: new Date(now - 1000) },
    ]);

    const first = await migrateRewardOrder();
    expect(first).toMatchObject({ skipped: false, updated: 3 });
    const ordered = await Reward.find().sort({ order: 1 }).lean();
    expect(ordered.map((r) => r.title)).toEqual(['Yangi', "O'rta", 'Eski']);

    // Admin tartibni o'zgartirdi — keyingi deploy'dagi migratsiya uni buzmasligi kerak
    await Reward.updateOne({ title: 'Eski' }, { order: 0 });
    await Reward.updateOne({ title: 'Yangi' }, { order: 2 });

    const second = await migrateRewardOrder();
    expect(second.skipped).toBe(true);
    expect((await Reward.findOne({ title: 'Eski' })).order).toBe(0);
    expect((await Reward.findOne({ title: 'Yangi' })).order).toBe(2);
  });

  test('reward-order: dryRun hech narsa yozmaydi', async () => {
    await mongoose.connection.collection('rewards').insertOne({ title: 'A', cost: 1, createdAt: new Date() });
    await mongoose.connection.collection('rewards').insertOne({ title: 'B', cost: 1, createdAt: new Date() });

    const result = await migrateRewardOrder({ dryRun: true });
    expect(result).toMatchObject({ skipped: false, updated: 0 });
    expect(await Reward.countDocuments({ order: { $exists: true } })).toBe(0);
  });
});
