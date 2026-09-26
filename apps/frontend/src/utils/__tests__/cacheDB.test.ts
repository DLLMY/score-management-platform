import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  openCacheDB,
  setCache,
  getCache,
  deleteCache,
  clearCache,
  deleteCacheByPattern,
  cleanupExpiredCache,
  getCacheStats,
} from '../cacheDB';

describe('cacheDB', () => {
  beforeEach(async () => {
    await clearCache();
  });

  it('openCacheDB 复用模块级 dbInstance 单例', async () => {
    const a = await openCacheDB();
    const b = await openCacheDB();
    expect(a).toBe(b);
    expect(typeof a.transaction).toBe('function');
  });

  it('setCache 后 getCache 返回数据且 fromCache=true', async () => {
    await setCache('user:1', { name: '张三' });
    const res = await getCache('user:1');
    expect(res).not.toBeNull();
    expect(res!.data).toEqual({ name: '张三' });
    expect(res!.fromCache).toBe(true);
  });

  it('getCache 不存在的 key 返回 null', async () => {
    expect(await getCache('nope:missing')).toBeNull();
  });

  it('过期条目（ttl<0）getCache 返回 null 并触发删除', async () => {
    await setCache('expired', 'old', -1);
    expect(await getCache('expired')).toBeNull();
    // 删除后再 get 仍为 null（无副作用）
    expect(await getCache('expired')).toBeNull();
  });

  it('deleteCache 删除指定条目', async () => {
    await setCache('k1', 1);
    await deleteCache('k1');
    expect(await getCache('k1')).toBeNull();
  });

  it('clearCache 清空所有缓存', async () => {
    await setCache('k1', 1);
    await setCache('k2', 2);
    await clearCache();
    expect(await getCache('k1')).toBeNull();
    expect(await getCache('k2')).toBeNull();
  });

  it('deleteCacheByPattern 仅删除匹配前缀的条目', async () => {
    await setCache('user:1', 'a');
    await setCache('user:2', 'b');
    await setCache('rule:1', 'c');
    await deleteCacheByPattern('user');
    expect(await getCache('user:1')).toBeNull();
    expect(await getCache('user:2')).toBeNull();
    const kept = await getCache('rule:1');
    expect(kept).not.toBeNull();
    expect(kept!.data).toBe('c');
  });

  it('cleanupExpiredCache 删除过期条目但保留有效条目', async () => {
    await setCache('old', 'x', -1);
    await setCache('fresh', 'y', 100000);
    await cleanupExpiredCache();
    expect(await getCache('old')).toBeNull();
    const kept = await getCache('fresh');
    expect(kept).not.toBeNull();
    expect(kept!.data).toBe('y');
  });

  it('getCacheStats 统计条目数', async () => {
    await setCache('s1', 1);
    await setCache('s2', 2);
    const stats = await getCacheStats();
    expect(stats.count).toBe(2);
    expect(stats.size).toBe(0);
  });

  describe('无 IndexedDB 环境时降级', () => {
    beforeEach(() => {
      // 重新加载模块使模块级 dbInstance 重置为 null，再剔除全局 indexedDB
      vi.resetModules();
      vi.stubGlobal('indexedDB', undefined);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    it('openCacheDB 在无 indexedDB 时 reject', async () => {
      const mod = await import('../cacheDB');
      await expect(mod.openCacheDB()).rejects.toThrow(/not supported/i);
    });

    it('setCache 降级不抛错', async () => {
      const mod = await import('../cacheDB');
      await expect(mod.setCache('x', 1)).resolves.toBeUndefined();
    });

    it('getCache 降级返回 null', async () => {
      const mod = await import('../cacheDB');
      expect(await mod.getCache('x')).toBeNull();
    });

    it('getCacheStats 降级返回 {count:0,size:0}', async () => {
      const mod = await import('../cacheDB');
      expect(await mod.getCacheStats()).toEqual({ count: 0, size: 0 });
    });

    it('deleteCache 降级不抛错', async () => {
      const mod = await import('../cacheDB');
      await expect(mod.deleteCache('x')).resolves.toBeUndefined();
    });

    it('clearCache 降级不抛错', async () => {
      const mod = await import('../cacheDB');
      await expect(mod.clearCache()).resolves.toBeUndefined();
    });

    it('deleteCacheByPattern 降级不抛错', async () => {
      const mod = await import('../cacheDB');
      await expect(mod.deleteCacheByPattern('x')).resolves.toBeUndefined();
    });

    it('cleanupExpiredCache 降级不抛错', async () => {
      const mod = await import('../cacheDB');
      await expect(mod.cleanupExpiredCache()).resolves.toBeUndefined();
    });
  });
});
