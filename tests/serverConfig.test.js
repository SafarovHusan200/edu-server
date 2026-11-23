const { parseOrigins, getCorsOrigin } = require('../src/config/cors');
const validateEnv = require('../src/config/env');

describe('CORS va env sozlamalari', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    jest.restoreAllMocks();
  });

  test("CLIENT_URL vergul bilan bir nechta sayt, oxiridagi / olib tashlanadi", () => {
    expect(parseOrigins(' https://edu-platform.uz/ , https://www.edu-platform.uz ,')).toEqual([
      'https://edu-platform.uz',
      'https://www.edu-platform.uz',
    ]);
    process.env.CLIENT_URL = 'https://edu-platform.uz';
    expect(getCorsOrigin()).toBe('https://edu-platform.uz');
    delete process.env.CLIENT_URL;
    expect(getCorsOrigin()).toBe('*'); // faqat development/test
  });

  test("production'da CLIENT_URL bo'lmasa server ishga tushmaydi", () => {
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    Object.assign(process.env, { NODE_ENV: 'production', PORT: '5000', MONGO_URI: 'mongodb://x', CLIENT_URL: '' });

    expect(() => validateEnv()).toThrow('exit');
    expect(exit).toHaveBeenCalledWith(1);

    process.env.CLIENT_URL = 'https://edu-platform.uz';
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => validateEnv()).not.toThrow();
  });
});
