import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RequestCoalescer,
  requestCoalescer,
  coalesceRequest,
  invalidateRequestCache,
  clearAllRequestCache,
} from '../requestCoalescing';

describe('RequestCoalescer · 合并与缓存', () => {
  let coalescer: RequestCoalescer;

  beforeEach(() => {
    // 独立实例，避免污染模块级单例
    coalescer = new RequestCoalescer();
  });

  afterEach(() => {
    coalescer.destroy();
    vi.restoreAllMocks();
  });

  it('coalesce：首次调用触发 fetcher 并透传 data', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    const res = await coalescer.coalesce({ url: '/a', method: 'GET' }, fetcher);
    expect(res).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(coalescer.getCacheSize()).toBe(1);
  });

  it('缓存命中（ttl 内）：不重复调用 fetcher', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    const r1 = await coalescer.coalesce({ url: '/a', method: 'GET' }, fetcher);
    const r2 = await coalescer.coalesce({ url: '/a', method: 'GET' }, fetcher);
    expect(r1).toBe('data');
    expect(r2).toBe('data');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('并发合并：同一 key 只触发一次 fetcher，多订阅者均获结果', async () => {
    let resolveFn: (v: unknown) => void = () => {};
    const fetcher = vi.fn(
      () => new Promise((resolve) => { resolveFn = resolve as (v: unknown) => void; })
    );
    const p1 = coalescer.coalesce({ url: '/b', method: 'GET' }, fetcher);
    const p2 = coalescer.coalesce({ url: '/b', method: 'GET' }, fetcher);
    expect(coalescer.getPendingCount()).toBe(1);
    resolveFn('shared');
    const [a, b] = await Promise.all([p1, p2]);
    expect(a).toBe('shared');
    expect(b).toBe('shared');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('不同 key 不合并：各自触发 fetcher', async () => {
    const f1 = vi.fn().mockResolvedValue('x');
    const f2 = vi.fn().mockResolvedValue('y');
    await coalescer.coalesce({ url: '/x', method: 'GET' }, f1);
    await coalescer.coalesce({ url: '/y', method: 'GET' }, f2);
    expect(f1).toHaveBeenCalledTimes(1);
    expect(f2).toHaveBeenCalledTimes(1);
  });

  it('fetcher 失败：rejectors 收到错误且 promise 抛错', async () => {
    const err = new Error('boom');
    const fetcher = vi.fn().mockRejectedValue(err);
    await expect(
      coalescer.coalesce({ url: '/err', method: 'GET' }, fetcher)
    ).rejects.toBe(err);
    // 失败不应写入缓存
    expect(coalescer.getCacheSize()).toBe(0);
  });

  it('invalidateCache：按 url 子串清理缓存', async () => {
    const fetcher = vi.fn().mockResolvedValue('v');
    await coalescer.coalesce({ url: '/api/users', method: 'GET' }, fetcher);
    await coalescer.coalesce({ url: '/api/posts', method: 'GET' }, fetcher);
    expect(coalescer.getCacheSize()).toBe(2);
    coalescer.invalidateCache('/api/users');
    expect(coalescer.getCacheSize()).toBe(1);
  });

  it('clearAll / destroy：清空 pending 与缓存并停止定时器', () => {
    const fetcher = vi.fn().mockResolvedValue('v');
    coalescer.coalesce({ url: '/c', method: 'GET' }, fetcher);
    expect(coalescer.getPendingCount()).toBe(1);
    coalescer.clearAll();
    expect(coalescer.getPendingCount()).toBe(0);
    expect(coalescer.getCacheSize()).toBe(0);
    // destroy 后 cleanupInterval 置空（不会重复清理）
    coalescer.destroy();
    coalescer.destroy(); // 幂等
  });
});

describe('requestCoalescing · 模块级单例导出', () => {
  afterEach(() => {
    clearAllRequestCache();
  });

  it('coalesceRequest / invalidateRequestCache / clearAllRequestCache 操作同一单例', async () => {
    const fetcher = vi.fn().mockResolvedValue('v');
    await coalesceRequest({ url: '/s', method: 'GET' }, fetcher);
    expect(requestCoalescer.getCacheSize()).toBeGreaterThanOrEqual(1);
    invalidateRequestCache('/s');
    expect(requestCoalescer.getCacheSize()).toBe(0);
    clearAllRequestCache();
    expect(requestCoalescer.getCacheSize()).toBe(0);
  });
});
