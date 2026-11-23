const app = require('../src/app');

describe("trust proxy (nginx ortida haqiqiy mijoz IP'si)", () => {
  test("standart holatda faqat shu mashinadagi proksiga ishoniladi", () => {
    const trust = app.get('trust proxy fn');
    expect(trust('127.0.0.1', 0)).toBe(true);
    expect(trust('::1', 0)).toBe(true);
    // Tashqi manzildan kelgan X-Forwarded-For soxtalashtirilgan bo'lishi mumkin
    expect(trust('203.0.113.7', 0)).toBe(false);
  });
});
