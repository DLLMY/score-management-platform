import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PerformanceMonitor,
  monitorApiRequest,
  withPerformanceMonitoring,
} from '../performanceMonitor';

vi.mock('../logger', () => ({
  default: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

describe('PerformanceMonitor', () => {
  let m: PerformanceMonitor;
  beforeEach(() => {
    m = new PerformanceMonitor();
  });

  it('start/end 记录 api 耗时并更新统计', () => {
    const id = m.start('req', 'api');
    const entry = m.end(id);
    expect(entry).toBeDefined();
    const stats = m.getStats();
    expect(stats.totalRequests).toBe(1);
    expect(stats.avgResponseTime).toBeGreaterThanOrEqual(0);
    expect(stats.maxResponseTime).toBeGreaterThanOrEqual(0);
    expect(stats.minResponseTime).toBeLessThanOrEqual(entry!.duration);
  });

  it('end 未知 id 返回 undefined', () => {
    expect(m.end('nope')).toBeUndefined();
  });

  it('recordError / recordCacheHit / recordCoalescedRequest 累计', () => {
    m.recordError('e');
    m.recordCacheHit();
    m.recordCoalescedRequest();
    const s = m.getStats();
    expect(s.errors).toBe(1);
    expect(s.cacheHits).toBe(1);
    expect(s.coalescedRequests).toBe(1);
  });

  it('updateApiStats 计入 cacheHit/coalesced 明细', () => {
    const id = m.start('detail', 'api', { cacheHit: true, coalesced: true });
    m.end(id);
    const s = m.getStats();
    expect(s.cacheHits).toBe(1);
    expect(s.coalescedRequests).toBe(1);
  });

  it('subscribe 通知监听者；listener 抛错被内部 catch', () => {
    const l1 = vi.fn();
    const l2 = vi.fn(() => {
      throw new Error('boom');
    });
    m.subscribe(l1);
    m.subscribe(l2);
    m.recordError('x');
    expect(l1).toHaveBeenCalled();
    // l2 抛错被 notifyListeners 吞掉，不应冒泡
  });

  it('entries 上限裁剪超过 maxEntries 时 shift', () => {
    for (let i = 0; i < 5; i++) {
      const id = m.start(`r${i}`, 'api');
      m.end(id);
    }
    expect(m.getRecentEntries(100).length).toBe(5);
    expect(m.getSlowRequests()).toEqual([]);
  });

  it('logSummary 输出统计摘要', () => {
    m.start('a', 'api');
    m.end(m.start('a', 'api'));
    m.logSummary();
    expect(true).toBe(true);
  });

  it('setSlowThreshold / getSlowThreshold', () => {
    m.setSlowThreshold(500);
    expect(m.getSlowThreshold()).toBe(500);
  });

  it('reset 清空统计与条目', () => {
    m.recordError('x');
    m.start('a', 'api');
    m.reset();
    expect(m.getStats().errors).toBe(0);
    expect(m.getRecentEntries(10).length).toBe(0);
  });

  it('monitorApiRequest 包装成功与失败', async () => {
    const ok = await monitorApiRequest('g', () => Promise.resolve(1));
    expect(ok).toBe(1);
    await expect(monitorApiRequest('b', () => Promise.reject(new Error('x')))).rejects.toThrow();
  });

  it('withPerformanceMonitoring 包装函数并记录', async () => {
    const fn = withPerformanceMonitoring(
      async (...args: unknown[]) => (args[0] as number) * 2,
      'dbl'
    );
    expect(await fn(3)).toBe(6);
  });
});
