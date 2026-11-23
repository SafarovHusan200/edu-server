// Eski gatewayDebug (Multicard xom javobi: to'lovchi telefoni, merchant ma'lumotlari)
// bazada qolgan bo'lsa ham API javobiga chiqmasligi kerak
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const { createUser } = require('./helpers');

describe("To'lovlar: eski gatewayDebug API'ga chiqmaydi", () => {
  test('GET /payment/my va GET /payment javobida gatewayDebug yo\'q', async () => {
    const { user, token } = await createUser({ role: 'student' });
    const { token: adminToken } = await createUser({ role: 'admin' });

    // Sxemadan tashqarida, to'g'ridan-to'g'ri kolleksiyaga — eski yozuvlar kabi
    await mongoose.connection.collection('payments').insertOne({
      user: user._id,
      invoiceId: 'ord_privacy_test',
      amount: 100000,
      purpose: 'premium',
      plan: '30d',
      method: 'multicard',
      status: 'success',
      gatewayDebug: { source: 'reconciliation', invoice: { merchant: { name: 'FIO', tin: '123' } } },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mine = await request(app).get('/api/v1/payment/my').set('Authorization', `Bearer ${token}`);
    expect(mine.status).toBe(200);
    expect(mine.body.data.payments).toHaveLength(1);
    expect(mine.body.data.payments[0]).not.toHaveProperty('gatewayDebug');

    const all = await request(app).get('/api/v1/payment').set('Authorization', `Bearer ${adminToken}`);
    expect(all.status).toBe(200);
    expect(JSON.stringify(all.body)).not.toContain('gatewayDebug');
  });
});
