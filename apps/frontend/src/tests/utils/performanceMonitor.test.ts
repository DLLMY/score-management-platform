import {
  PerformanceMonitor,
  performanceMonitor,
  monitorApiRequest,
  withPerformanceMonitoring,
} from '../../utils/performanceMonitor';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  test('should start and end a performance entry', () => {
    const id = monitor.start('test-api', 'api');

    expect(id).toBeDefined();
    expect(typeof id).toBe('string');

    const entry = monitor.end(id);

    expect(entry).toBeDefined();
    expect(entry?.id).toBe(id);
    expect(entry?.name).toBe('test-api');
    expect(entry?.type).toBe('api');
    expect(entry?.duration).toBeGreaterThanOrEqual(0);
  });

  test('should return undefined for unknown entry id', () => {
    const entry = monitor.end('unknown-id');
    expect(entry).toBeUndefined();
  });

  test('should update API stats on entry end', () => {
    const id = monitor.start('api-test', 'api');
    monitor.end(id);

    const stats = monitor.getStats();

    expect(stats.totalRequests).toBe(1);
    expect(stats.avgResponseTime).toBeGreaterThanOrEqual(0);
    expect(stats.maxResponseTime).toBeGreaterThanOrEqual(0);
    expect(stats.minResponseTime).toBeGreaterThanOrEqual(0);
  });

  test('should track slow requests', () => {
    monitor.setSlowThreshold(10);

    const id1 = monitor.start('fast-api', 'api');
    monitor.end(id1);

    const id2 = monitor.start('slow-api', 'api');
    jest.spyOn(performance, 'now').mockReturnValue(monitor['entries'][1].startTime + 20);
    monitor.end(id2);
    jest.restoreAllMocks();

    const stats = monitor.getStats();

    expect(stats.slowRequests).toBe(1);
  });

  test('should track cache hits via details', () => {
    const id = monitor.start('cached-api', 'api', { cacheHit: true });
    monitor.end(id);

    const stats = monitor.getStats();

    expect(stats.cacheHits).toBe(1);
  });

  test('should track coalesced requests via details', () => {
    const id = monitor.start('coalesced-api', 'api', { coalesced: true });
    monitor.end(id);

    const stats = monitor.getStats();

    expect(stats.coalescedRequests).toBe(1);
  });

  test('should record errors', () => {
    monitor.recordError('test-error');

    const stats = monitor.getStats();

    expect(stats.errors).toBe(1);
  });

  test('should record cache hits directly', () => {
    monitor.recordCacheHit();

    const stats = monitor.getStats();

    expect(stats.cacheHits).toBe(1);
  });

  test('should record coalesced requests directly', () => {
    monitor.recordCoalescedRequest();

    const stats = monitor.getStats();

    expect(stats.coalescedRequests).toBe(1);
  });

  test('should limit entries to maxEntries', () => {
    monitor['maxEntries'] = 5;

    for (let i = 0; i < 10; i++) {
      const id = monitor.start(`api-${i}`, 'api');
      monitor.end(id);
    }

    const entries = monitor.getRecentEntries();

    expect(entries.length).toBe(5);
  });

  test('should return recent entries', () => {
    for (let i = 0; i < 5; i++) {
      const id = monitor.start(`api-${i}`, 'api');
      monitor.end(id);
    }

    const recent = monitor.getRecentEntries(3);

    expect(recent.length).toBe(3);
    expect(recent[0].name).toBe('api-4');
    expect(recent[1].name).toBe('api-3');
    expect(recent[2].name).toBe('api-2');
  });

  test('should return slow requests', () => {
    monitor.setSlowThreshold(10);

    const id1 = monitor.start('fast', 'api');
    monitor.end(id1);

    const id2 = monitor.start('slow1', 'api');
    jest.spyOn(performance, 'now').mockReturnValue(monitor['entries'][1].startTime + 20);
    monitor.end(id2);
    jest.restoreAllMocks();

    const id3 = monitor.start('slow2', 'api');
    jest.spyOn(performance, 'now').mockReturnValue(monitor['entries'][2].startTime + 30);
    monitor.end(id3);
    jest.restoreAllMocks();

    const slowRequests = monitor.getSlowRequests();

    expect(slowRequests.length).toBe(2);
    expect(slowRequests[0].duration).toBeGreaterThan(slowRequests[1].duration);
  });

  test('should support subscriptions', () => {
    const listener = jest.fn();

    const unsubscribe = monitor.subscribe(listener);

    const id = monitor.start('api', 'api');
    monitor.end(id);

    expect(listener).toHaveBeenCalled();

    unsubscribe();

    const id2 = monitor.start('api2', 'api');
    monitor.end(id2);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('should reset stats', () => {
    const id = monitor.start('api', 'api');
    monitor.end(id);
    monitor.recordError('error');

    monitor.reset();

    const stats = monitor.getStats();

    expect(stats.totalRequests).toBe(0);
    expect(stats.errors).toBe(0);
    expect(stats.slowRequests).toBe(0);
    expect(stats.cacheHits).toBe(0);
    expect(stats.coalescedRequests).toBe(0);
  });

  test('should log summary', () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    monitor.logSummary();

    expect(consoleLogSpy).toHaveBeenCalled();

    consoleLogSpy.mockRestore();
  });

  test('should get and set slow threshold', () => {
    expect(monitor.getSlowThreshold()).toBe(3000);

    monitor.setSlowThreshold(1000);

    expect(monitor.getSlowThreshold()).toBe(1000);
  });
});

describe('performanceMonitor singleton', () => {
  test('should export singleton instance', () => {
    expect(performanceMonitor).toBeInstanceOf(PerformanceMonitor);
  });
});

describe('monitorApiRequest', () => {
  beforeEach(() => {
    performanceMonitor.reset();
  });

  test('should monitor successful API requests', async () => {
    const fetcher = jest.fn().mockResolvedValue('result');

    await monitorApiRequest('test-api', fetcher);

    expect(fetcher).toHaveBeenCalled();

    const stats = performanceMonitor.getStats();
    expect(stats.totalRequests).toBe(1);
  });

  test('should monitor failed API requests', async () => {
    const error = new Error('API error');
    const fetcher = jest.fn().mockRejectedValue(error);

    await expect(monitorApiRequest('test-api', fetcher)).rejects.toThrow(error);

    expect(fetcher).toHaveBeenCalled();

    const stats = performanceMonitor.getStats();
    expect(stats.totalRequests).toBe(1);
    expect(stats.errors).toBe(1);
  });
});

describe('withPerformanceMonitoring', () => {
  beforeEach(() => {
    performanceMonitor.reset();
  });

  test('should wrap function with performance monitoring', async () => {
    const originalFn = jest.fn().mockResolvedValue('result');
    const wrappedFn = withPerformanceMonitoring(originalFn, 'wrapped-api');

    await wrappedFn();

    expect(originalFn).toHaveBeenCalled();

    const stats = performanceMonitor.getStats();
    expect(stats.totalRequests).toBeGreaterThan(0);
  });

  test('should pass arguments to original function', async () => {
    const originalFn = jest.fn().mockResolvedValue('result');
    const wrappedFn = withPerformanceMonitoring(originalFn, 'wrapped-api');

    await wrappedFn('arg1', { key: 'value' });

    expect(originalFn).toHaveBeenCalledWith('arg1', { key: 'value' });
  });
});
