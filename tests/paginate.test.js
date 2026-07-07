const { getPagination, buildMeta } = require('../src/utils/paginate');

describe('paginate util', () => {
  test('page/limit berilmasa standart qiymatlarni ishlatadi', () => {
    const { page, limit, skip } = getPagination({});
    expect(page).toBe(1);
    expect(limit).toBe(10);
    expect(skip).toBe(0);
  });

  test('page va limit to\'g\'ri hisoblanadi', () => {
    const { page, limit, skip } = getPagination({ page: '3', limit: '5' });
    expect(page).toBe(3);
    expect(limit).toBe(5);
    expect(skip).toBe(10);
  });

  test('manfiy page 1 ga tushiriladi', () => {
    const { page } = getPagination({ page: '-5' });
    expect(page).toBe(1);
  });

  test('limit=0 standart qiymatga tushadi (0 ta element so\'ralishi ma\'nosiz)', () => {
    const { limit } = getPagination({ limit: '0' });
    expect(limit).toBe(10);
  });

  test('limit MAX_LIMIT dan oshsa cheklanadi', () => {
    const { limit } = getPagination({ limit: '1000' });
    expect(limit).toBe(100);
  });

  test('buildMeta totalPages ni to\'g\'ri hisoblaydi', () => {
    const meta = buildMeta(25, 2, 10);
    expect(meta).toEqual({ total: 25, page: 2, limit: 10, totalPages: 3 });
  });
});
