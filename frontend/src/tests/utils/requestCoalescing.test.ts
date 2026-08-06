import { RequestCoalescer, requestCoalescer, coalesceRequest, invalidateRequestCache, clearAllRequestCache } from '../../utils/requestCoalescing';

describe('RequestCoalescer', () => {
  let coalescer: RequestCoalescer;

  beforeEach(() => {
    coalescer = new RequestCoalescer();
  });

  afterEach(() => {
    coalescer.destroy();
  });

  test('should coalesce multiple identical requests', async () => {
    const fetcher = jest.fn().mockResolvedValue('test-data');
    
    const promises = await Promise.all([
      coalescer.coalesce({ url: '/api/test', method: 'GET' }, fetcher),
      coalescer.coalesce({ url: '/api/test', method: 'GET' }, fetcher),
      coalescer.coalesce({ url: '/api/test', method: 'GET' }, fetcher),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(promises).toEqual(['test-data', 'test-data', 'test-data']);
  });

  test('should not coalesce different requests', async () => {
    const fetcher = jest.fn().mockResolvedValue('test-data');
    
    await Promise.all([
      coalescer.coalesce({ url: '/api/test1', method: 'GET' }, fetcher),
      coalescer.coalesce({ url: '/api/test2', method: 'GET' }, fetcher),
      coalescer.coalesce({ url: '/api/test1', method: 'POST' }, fetcher),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  test('should cache results with TTL', async () => {
    const fetcher = jest.fn().mockResolvedValue('cached-data');
    
    await coalescer.coalesce({ url: '/api/cache', method: 'GET' }, fetcher, 1000);
    await coalescer.coalesce({ url: '/api/cache', method: 'GET' }, fetcher, 1000);
    
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('should invalidate cache after TTL', async () => {
    const fetcher = jest.fn().mockResolvedValue('fresh-data');
    
    await coalescer.coalesce({ url: '/api/ttl', method: 'GET' }, fetcher, 1);
    await new Promise(resolve => setTimeout(resolve, 10));
    await coalescer.coalesce({ url: '/api/ttl', method: 'GET' }, fetcher, 1);
    
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test('should invalidate cache by URL', async () => {
    const fetcher = jest.fn().mockResolvedValue('data');
    
    await coalescer.coalesce({ url: '/api/users', method: 'GET' }, fetcher);
    await coalescer.coalesce({ url: '/api/users/1', method: 'GET' }, fetcher);
    
    expect(fetcher).toHaveBeenCalledTimes(2);
    
    coalescer.invalidateCache('/api/users');
    
    expect(coalescer.getCacheSize()).toBe(0);
  });

  test('should handle rejected promises', async () => {
    const error = new Error('Network error');
    const fetcher = jest.fn().mockRejectedValue(error);
    
    await expect(coalescer.coalesce({ url: '/api/error', method: 'GET' }, fetcher)).rejects.toThrow(error);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('should handle params in request key', async () => {
    const fetcher = jest.fn().mockResolvedValue('data');
    
    await coalescer.coalesce({ url: '/api/search', method: 'GET', params: { q: 'test' } }, fetcher);
    await coalescer.coalesce({ url: '/api/search', method: 'GET', params: { q: 'test' } }, fetcher);
    await coalescer.coalesce({ url: '/api/search', method: 'GET', params: { q: 'other' } }, fetcher);
    
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test('should handle body in request key', async () => {
    const fetcher = jest.fn().mockResolvedValue('data');
    
    await coalescer.coalesce({ url: '/api/create', method: 'POST', body: { name: 'test' } }, fetcher);
    await coalescer.coalesce({ url: '/api/create', method: 'POST', body: { name: 'test' } }, fetcher);
    await coalescer.coalesce({ url: '/api/create', method: 'POST', body: { name: 'other' } }, fetcher);
    
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test('should clear all cache', async () => {
    const fetcher = jest.fn().mockResolvedValue('data');
    
    await coalescer.coalesce({ url: '/api/a', method: 'GET' }, fetcher);
    await coalescer.coalesce({ url: '/api/b', method: 'GET' }, fetcher);
    
    expect(coalescer.getCacheSize()).toBe(2);
    
    coalescer.clearAll();
    
    expect(coalescer.getCacheSize()).toBe(0);
    expect(coalescer.getPendingCount()).toBe(0);
  });
});

describe('requestCoalescer singleton', () => {
  test('should export singleton instance', () => {
    expect(requestCoalescer).toBeInstanceOf(RequestCoalescer);
  });

  test('coalesceRequest should delegate to singleton', async () => {
    const fetcher = jest.fn().mockResolvedValue('data');
    
    await coalesceRequest({ url: '/api/singleton', method: 'GET' }, fetcher);
    
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('invalidateRequestCache should delegate to singleton', () => {
    invalidateRequestCache('/api/test');
  });

  test('clearAllRequestCache should delegate to singleton', () => {
    clearAllRequestCache();
  });
});