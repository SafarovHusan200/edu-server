const {
  MINI_APP_URL,
  canUseMiniApp,
  buildMenuButton,
  buildOpenButton,
} = require('../src/bot/miniApp');

describe('Telegram Mini App (o\'qituvchi/admin)', () => {
  const verified = (role, extra = {}) => ({ role, isVerified: true, isBlocked: false, ...extra });

  test('manzil frontenddagi /tg sahifasiga ishora qiladi', () => {
    expect(MINI_APP_URL).toMatch(/^https:\/\/.+\/tg$/);
  });

  test("tasdiqlangan o'qituvchi, admin va superadmin Mini App'ni ochadi", () => {
    expect(canUseMiniApp(verified('teacher'))).toBe(true);
    expect(canUseMiniApp(verified('admin'))).toBe(true);
    expect(canUseMiniApp(verified('superadmin'))).toBe(true);
  });

  test("o'quvchi, tasdiqlanmagan va bloklangan foydalanuvchi ochmaydi", () => {
    expect(canUseMiniApp(verified('student'))).toBe(false);
    expect(canUseMiniApp(verified('teacher', { isVerified: false }))).toBe(false);
    expect(canUseMiniApp(verified('admin', { isBlocked: true }))).toBe(false);
    expect(canUseMiniApp(null)).toBe(false);
  });

  test("menyu tugmasi: ruxsat bo'lsa web_app, aks holda default", () => {
    expect(buildMenuButton(verified('teacher'))).toEqual({
      type: 'web_app',
      text: expect.any(String),
      web_app: { url: MINI_APP_URL },
    });
    expect(buildMenuButton(verified('student'))).toEqual({ type: 'default' });
    // Bloklanganda eski Mini App tugmasi olib tashlanadi
    expect(buildMenuButton(verified('teacher', { isBlocked: true }))).toEqual({ type: 'default' });
  });

  test("https bo'lmagan manzil uchun web_app tugmasi berilmaydi (Telegram rad etadi)", () => {
    expect(buildMenuButton(verified('teacher'), 'http://localhost:3000/tg')).toEqual({ type: 'default' });
  });

  test("ochish tugmasi /tg ichidagi bo'limga olib boradi", () => {
    expect(buildOpenButton('/teacher/grading')).toEqual({
      text: expect.any(String),
      web_app: { url: `${MINI_APP_URL}/teacher/grading` },
    });
  });
});
