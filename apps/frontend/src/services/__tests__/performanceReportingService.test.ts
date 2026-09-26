import { beforeEach, describe, expect, it, vi } from 'vitest';
import { performanceReportingService as service } from '../performanceReportingService';

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../config', () => ({
  config: { app: { isDevelopment: true } },
  getApiUrl: () => 'http://localhost:5000',
}));
vi.mock('../../utils/logger', () => ({ default: mockLogger }));

const API = 'http://localhost:5000';

type PrivateFields = {
  queue: Record<string, unknown>[];
  errorQueue: Record<string, unknown>[];
  isFlushing: boolean;
  rateLimitedUntil: number | null;
  stopFlushInterval: () => void;
  flush: () => Promise<void>;
  flushErrors: () => Promise<void>;
};

const priv = service as unknown as PrivateFields;

// jsdom 对 sendBeacon 支持不稳定：统一用可写的 stub 记录调用（避免改动真实 navigator）
const beaconCalls: { url: string; blob: Blob }[] = [];
Object.defineProperty(navigator, 'sendBeacon', {
  configurable: true,
  writable: true,
  value: (url: string, blob: Blob) => {
    beaconCalls.push({ url, blob });
    return true;
  },
});

const setHash = (hash: string) => {
  window.location.hash = hash;
};

describe('performanceReportingService', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', mockFetch);
    mockLogger.debug.mockClear();
    priv.queue.length = 0;
    priv.errorQueue.length = 0;
    priv.isFlushing = false;
    priv.rateLimitedUntil = null;
    beaconCalls.length = 0;
    // 停掉构造期启动的 5s 轮询，避免跨用例自动 flush 干扰断言
    priv.stopFlushInterval();
    setHash('#/');
  });

  describe('reportMetric / 队列', () => {
    it('补齐 timestamp / page / 环境信息后入队', () => {
      setHash('#/users');
      service.reportMetric({ type: 'web_vital', name: 'LCP', value: 123 });

      expect(priv.queue).toHaveLength(1);
      const metric = priv.queue[0];
      expect(metric.type).toBe('web_vital');
      expect(metric.name).toBe('LCP');
      expect(metric.value).toBe(123);
      expect(metric.page).toBe('users');
      expect(typeof metric.timestamp).toBe('string');
      expect(typeof metric.user_agent).toBe('string');
      expect(typeof metric.screen_width).toBe('number');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('队列达到 MAX_QUEUE_SIZE(50) 时自动 flush', async () => {
      for (let i = 0; i < 49; i++) {
        service.reportMetric({ type: 'm', name: `n${i}`, value: i });
      }
      expect(mockFetch).not.toHaveBeenCalled();

      service.reportMetric({ type: 'm', name: 'n49', value: 49 });
      expect(priv.queue).toHaveLength(0); // flush 已取出
      // 自动 flush 是浮动 Promise：必须等到本次 fetch 真正结束，
      // 否则残留的微任务会在后续用例中继续调用 mockFetch 污染计数（曾致 5/7 次误报）
      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
      expect(mockFetch.mock.calls[0][0]).toBe(`${API}/api/system/frontend-performance/batch`);
    });

    it.each([
      ['#/dashboard', 'dashboard'],
      ['#/users', 'users'],
      ['#/rules', 'rules'],
      ['#/devices', 'devices'],
      ['#/analysis', 'analysis'],
      ['#/exams', 'exams'],
      ['#/login', 'login'],
      ['#/unknown-page', '/unknown-page'],
      // 空 hash：`hash.replace(^#,'') || '/'` 兜底成 '/'，再由 `path || 'unknown'` 返回 '/'
      ['', '/'],
      // 纯查询串：路径部分为空 → 回落 'unknown'
      ['#?tab=1', 'unknown'],
    ])('getCurrentPage 解析 hash %s -> %s', (hash, expected) => {
      setHash(hash);
      service.reportMetric({ type: 'm', name: 'n', value: 1 });
      expect(priv.queue[priv.queue.length - 1].page).toBe(expected);
    });

    it('getCurrentPage 忽略 hash 中的查询串', () => {
      setHash('#/devices?tab=list');
      service.reportMetric({ type: 'm', name: 'n', value: 1 });
      expect(priv.queue[priv.queue.length - 1].page).toBe('devices');
    });
  });

  describe('reportError / 错误队列', () => {
    it('补齐 timestamp / page / user_agent 后入队并在 dev 下记录 debug', () => {
      setHash('#/analysis');
      service.reportError({ type: 'javascript_error', message: 'boom' });

      expect(priv.errorQueue).toHaveLength(1);
      expect(priv.errorQueue[0]).toMatchObject({
        type: 'javascript_error',
        message: 'boom',
        page: 'analysis',
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[Error] Reported:',
        expect.objectContaining({ message: 'boom' })
      );
    });

    it('错误队列达到 50 时自动 flushErrors', async () => {
      for (let i = 0; i < 50; i++) {
        service.reportError({ type: 'e', message: `m${i}` });
      }
      // flushErrors 逐条 await fetch，须等全部落定（同上的浮动 Promise 泄漏风险）
      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(50));
      expect(mockFetch.mock.calls[0][0]).toBe(`${API}/api/system/frontend-error`);
    });
  });

  describe('flush', () => {
    it('空队列直接返回，不发请求', async () => {
      await service.flush();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('单条指标走单条上报端点', async () => {
      service.reportMetric({ type: 'web_vital', name: 'FCP', value: 10, unit: 'ms' });
      await service.flush();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe(`${API}/api/system/frontend-performance`);
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(JSON.parse(init.body)).toMatchObject({ type: 'web_vital', name: 'FCP' });
      expect(priv.queue).toHaveLength(0);
    });

    it('多条指标走批量上报端点', async () => {
      service.reportMetric({ type: 'm', name: 'a', value: 1 });
      service.reportMetric({ type: 'm', name: 'b', value: 2 });
      await service.flush();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe(`${API}/api/system/frontend-performance/batch`);
      expect(JSON.parse(init.body).metrics).toHaveLength(2);
    });

    it('并发布发时 isFlushing 保护：第二次 flush 短路', async () => {
      service.reportMetric({ type: 'm', name: 'a', value: 1 });
      const p1 = service.flush();
      const p2 = service.flush();
      await Promise.all([p1, p2]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('429 触发 60s 退避，窗口内 flush 不再发请求', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 429 });
      service.reportMetric({ type: 'm', name: 'a', value: 1 });
      await service.flush();

      expect(priv.rateLimitedUntil).not.toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith('[Performance] 429 限流，暂停上报 60s');

      mockFetch.mockClear();
      service.reportMetric({ type: 'm', name: 'b', value: 2 });
      await service.flush();
      expect(mockFetch).not.toHaveBeenCalled();
      expect(priv.queue).toHaveLength(1); // 退避期间队列保留
    });

    it('fetch 网络失败（reject）时静默并记录 debug', async () => {
      mockFetch.mockRejectedValue(new Error('offline'));
      service.reportMetric({ type: 'm', name: 'a', value: 1 });
      await expect(service.flush()).resolves.toBeUndefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[Performance] Flush 失败: network (1 metrics, silently ignored)'
      );
    });

    it('响应 !ok 时记录状态码 debug', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      service.reportMetric({ type: 'm', name: 'a', value: 1 });
      await service.flush();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[Performance] Flush 失败: 500 (1 metrics, silently ignored)'
      );
    });

    it('成功时不打印 debug', async () => {
      service.reportMetric({ type: 'm', name: 'a', value: 1 });
      await service.flush();
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe('flushErrors', () => {
    it('空队列直接返回', async () => {
      await service.flushErrors();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('逐条上报并统计成功数', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      service.reportError({ type: 'e', message: 'a' });
      service.reportError({ type: 'e', message: 'b' });

      await service.flushErrors();
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0][0]).toBe(`${API}/api/system/frontend-error`);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[Error] Flushed: 1/2 errors (silently handled)'
      );
      expect(priv.errorQueue).toHaveLength(0);
    });

    it('全部失败时成功数为 0', async () => {
      mockFetch.mockRejectedValue(new Error('offline'));
      service.reportError({ type: 'e', message: 'a' });
      await expect(service.flushErrors()).resolves.toBeUndefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[Error] Flushed: 0/1 errors (silently handled)'
      );
    });
  });

  describe('便捷上报方法', () => {
    it.each([
      ['reportWebVital', 'web_vital'],
      ['reportComponentRender', 'component_render'],
    ])('%s 入队对应类型', (method, type) => {
      if (method === 'reportWebVital') {
        service.reportWebVital('TTI', 999);
      } else {
        service.reportComponentRender('Header', 12);
      }
      expect(priv.queue[0]).toMatchObject({ type, value: expect.any(Number), unit: 'ms' });
    });

    it('reportApiRequest 组装 name 与 data', () => {
      service.reportApiRequest('/api/users', 'GET', 120, 200);
      expect(priv.queue[0]).toMatchObject({
        type: 'api_request',
        name: 'GET /api/users',
        value: 120,
        unit: 'ms',
        data: { url: '/api/users', method: 'GET', status: 200 },
      });
    });

    it('reportMemoryUsage 组装 bytes 指标', () => {
      service.reportMemoryUsage(1024, 4096);
      expect(priv.queue[0]).toMatchObject({
        type: 'memory',
        name: 'used_heap_size',
        value: 1024,
        unit: 'bytes',
        data: { totalJSHeapSize: 4096 },
      });
    });

    it('reportResourceLoad 组装资源加载指标', () => {
      service.reportResourceLoad('script', 'main.js', 88, 2048);
      expect(priv.queue[0]).toMatchObject({
        type: 'resource_load',
        name: 'script: main.js',
        value: 88,
        data: { resourceType: 'script', name: 'main.js', size: 2048 },
      });
    });

    it('reportJavaScriptError 入队 javascript_error', () => {
      const err = new Error('boom');
      err.stack = 'st';
      service.reportJavaScriptError(err, 'app.js', 10, 20);
      expect(priv.errorQueue[0]).toMatchObject({
        type: 'javascript_error',
        message: 'boom',
        stack: 'st',
        file: 'app.js',
        line: 10,
        column: 20,
      });
    });

    it('reportApiError 入队 api_error', () => {
      service.reportApiError('/api/x', 'POST', 400, 'bad request');
      expect(priv.errorQueue[0]).toMatchObject({
        type: 'api_error',
        message: 'bad request',
        url: '/api/x',
        method: 'POST',
        status: 400,
      });
    });
  });

  describe('页面卸载上报 / destroy', () => {
    it('beforeunload 经 sendBeacon 上报 metrics Blob 与 errors Blob', () => {
      service.reportMetric({ type: 'm', name: 'a', value: 1 });
      service.reportError({ type: 'e', message: 'boom' });

      window.dispatchEvent(new Event('beforeunload'));

      expect(beaconCalls).toHaveLength(2);
      expect(beaconCalls[0].url).toBe(`${API}/api/system/frontend-performance/batch`);
      expect(beaconCalls[0].blob.type).toBe('application/json');
      expect(beaconCalls[1].url).toBe(`${API}/api/system/frontend-error`);
      expect(beaconCalls[1].blob.type).toBe('application/json');
    });

    it('队列为空时 beforeunload 不发 Beacon', () => {
      window.dispatchEvent(new Event('pagehide'));
      expect(beaconCalls).toHaveLength(0);
    });

    it('destroy 停止轮询并触发 flush / flushErrors', () => {
      const flushSpy = vi.spyOn(priv, 'flush').mockResolvedValue(undefined);
      const errorsSpy = vi.spyOn(priv, 'flushErrors').mockResolvedValue(undefined);

      service.destroy();

      expect(flushSpy).toHaveBeenCalledTimes(1);
      expect(errorsSpy).toHaveBeenCalledTimes(1);
      flushSpy.mockRestore();
      errorsSpy.mockRestore();
    });
  });
});
