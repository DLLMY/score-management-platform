import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatRelativeTime,
  formatDateTime,
  formatDate,
  formatUptime,
  formatFileSize,
  formatHourMinute,
  formatNumber,
  formatPercent,
  formatCurrency,
  formatCompact,
  formatScore,
} from '../format';

describe('format · 相对时间', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('空值/非法值回退占位符', () => {
    expect(formatRelativeTime(undefined)).toBe('--');
    expect(formatRelativeTime(null)).toBe('--');
    expect(formatRelativeTime('')).toBe('--');
    expect(formatRelativeTime('not-a-date')).toBe('--');
  });

  it('各时间跨度文案（固定系统时钟）', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T12:00:00'));
    const base = new Date('2026-09-23T12:00:00').getTime();
    const m = (offsetMs: number) => new Date(base - offsetMs).toISOString();

    expect(formatRelativeTime(m(0))).toBe('刚刚'); // 0 分钟
    expect(formatRelativeTime(m(5 * 60000))).toBe('5分钟前');
    expect(formatRelativeTime(m(3 * 3600000))).toBe('3小时前');
    expect(formatRelativeTime(m(2 * 86400000))).toBe('2天前');
    // 超过 7 天 → 具体日期（zh-CN MM/DD）
    expect(formatRelativeTime(m(10 * 86400000))).toBe('09/13');
  });
});

describe('format · 日期时间', () => {
  it('formatDateTime：空值回退 --，合法值走 zh-CN 本地串', () => {
    expect(formatDateTime(undefined)).toBe('--');
    expect(formatDateTime(null)).toBe('--');
    expect(formatDateTime('')).toBe('--');
    expect(formatDateTime(new Date('2026-08-22T21:30:00'))).toContain('2026');
  });

  it('formatDate：默认与 withWeekday 两形态', () => {
    expect(formatDate(undefined)).toBe('--');
    const d = new Date('2026-08-22T00:00:00');
    expect(formatDate(d)).toContain('2026');
    expect(formatDate(d, true)).toContain('2026');
  });
});

describe('format · 运行时长 / 文件大小', () => {
  it('formatUptime：空值回退 -，按天/时/分递进', () => {
    expect(formatUptime(undefined)).toBe('-');
    expect(formatUptime(0)).toBe('-');
    expect(formatUptime(-5)).toBe('-');
    expect(formatUptime(5 * 60)).toBe('5分钟');
    expect(formatUptime(2 * 3600 + 30 * 60)).toBe('2小时 30分钟');
    expect(formatUptime(3 * 86400 + 4 * 3600)).toBe('3天 4小时');
  });

  it('formatFileSize：B/KB/MB/GB 与边界', () => {
    expect(formatFileSize(undefined)).toBe('-');
    expect(formatFileSize(-1)).toBe('-');
    expect(formatFileSize(0)).toBe('-'); // 0 视为空值
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
    expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
  });
});

describe('format · 时分 / 数字族', () => {
  it('formatHourMinute：补零', () => {
    expect(formatHourMinute(9, 5)).toBe('09:05');
    expect(formatHourMinute(23, 59)).toBe('23:59');
    expect(formatHourMinute(0, 0)).toBe('00:00');
  });

  it('formatNumber：空值回退 --，保留小数', () => {
    expect(formatNumber(null)).toBe('--');
    expect(formatNumber(undefined)).toBe('--');
    expect(formatNumber('')).toBe('--');
    expect(formatNumber('abc')).toBe('--');
    expect(formatNumber(3.14159, 2)).toBe('3.14');
    expect(formatNumber(1000)).toBe('1000');
    expect(formatNumber('42', 0)).toBe('42');
  });

  it('formatPercent：非数字回退 --，否则追加 %', () => {
    expect(formatPercent(null)).toBe('--');
    expect(formatPercent(85.7, 1)).toBe('85.7%'); // 入参为已放大数值
  });

  it('formatCurrency：¥ + 千分位两位小数', () => {
    expect(formatCurrency(null)).toBe('--');
    expect(formatCurrency(1234.5)).toBe('¥1,234.50');
    expect(formatCurrency(0)).toBe('¥0.00');
  });

  it('formatCompact：千分位整数', () => {
    expect(formatCompact(null)).toBe('--');
    expect(formatCompact(12345)).toBe('12,345');
  });

  it('formatScore：默认 1 位小数', () => {
    expect(formatScore(null)).toBe('--');
    expect(formatScore(88.5)).toBe('88.5');
    expect(formatScore(88.5, 0)).toBe('89'); // toFixed(0) 四舍五入
  });
});
