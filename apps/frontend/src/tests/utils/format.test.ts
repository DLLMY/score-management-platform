import { formatDateTime, formatDate } from '../../utils/format';

describe('formatDateTime', () => {
  test('returns default fallback for empty value', () => {
    expect(formatDateTime(null)).toBe('--');
    expect(formatDateTime(undefined)).toBe('--');
    expect(formatDateTime('')).toBe('--');
  });

  test('returns custom fallback when provided', () => {
    expect(formatDateTime(null, '-')).toBe('-');
    expect(formatDateTime(undefined, '未知')).toBe('未知');
  });

  test('formats ISO string in zh-CN 24h format', () => {
    const result = formatDateTime('2026-08-23T10:30:00');
    // 中文环境 toLocaleString 形如 "2026/8/23 10:30:00"
    expect(result).toContain('2026');
    expect(result).toContain('10:30');
    expect(result).not.toContain('下午');
  });

  test('formats Date object', () => {
    const date = new Date(2026, 7, 23, 9, 5); // 2026-08-23 09:05
    const result = formatDateTime(date);
    expect(result).toContain('9:05');
  });

  test('falls back for invalid date string', () => {
    expect(formatDateTime('not-a-date')).toBe('--');
    expect(formatDateTime('not-a-date', '-')).toBe('-');
  });
});

describe('formatDate', () => {
  test('returns default fallback for empty value', () => {
    expect(formatDate(null)).toBe('--');
  });

  test('formats date-only value', () => {
    const result = formatDate('2026-08-23');
    expect(result).toContain('2026/08/23');
  });

  test('withWeekday appends weekday text', () => {
    // 2026-08-23 是周日
    const result = formatDate('2026-08-23', true);
    expect(result).toContain('2026/08/23');
    expect(result).toContain('周日');
  });

  test('falls back for invalid value', () => {
    expect(formatDate('garbage')).toBe('--');
  });
});
