import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getVitals, observeVitals, initVitalsMonitor } from '../webVitals';

// 真实 performanceReportingService 会在测试中触发网络/缓存噪音，替换为受控桩
const mockReportWebVital = vi.fn();
const { mockConfig } = vi.hoisted(() => ({ mockConfig: { devTools: { enabled: true } } }));

vi.mock('../../services/performanceReportingService', () => ({
  performanceReportingService: {
    reportWebVital: (...a: unknown[]) => mockReportWebVital(...a),
  },
}));
vi.mock('../../config', () => ({ config: mockConfig }));

/**
 * 极简 PerformanceObserver 桩：记录实例、捕获 observe 的 entryTypes、提供 fire() 手动触发回调。
 * 用于覆盖 measureFCP/LCP/CLS/FID/INP 内部的回调体（jsdom 无真实性能条目）。
 */
class FakePerformanceObserver {
  cb: (list: { getEntries: () => unknown[] }) => void;
  entryTypes: string[] = [];
  static instances: FakePerformanceObserver[] = [];
  constructor(cb: (list: { getEntries: () => unknown[] }) => void) {
    this.cb = cb;
    FakePerformanceObserver.instances.push(this);
  }
  observe(opts: { entryTypes: string[] }) {
    this.entryTypes = opts.entryTypes;
  }
  disconnect() {
    // 模拟注销：回调置空，避免后续误触发
    this.cb = () => {};
  }
  fire(entries: unknown[]) {
    this.cb({ getEntries: () => entries });
  }
}

describe('webVitals · 指标采集', () => {
  beforeEach(() => {
    mockReportWebVital.mockReset();
    mockConfig.devTools.enabled = true;
    FakePerformanceObserver.instances = [];
    (globalThis as unknown as { PerformanceObserver: unknown }).PerformanceObserver =
      FakePerformanceObserver;
    (globalThis as unknown as { performance: unknown }).performance = {
      getEntriesByType: (type: string) =>
        type === 'navigation' ? [{ responseStart: 123.45 }] : [],
    };
    vi.spyOn(console, 'group').mockImplementation(() => {});
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getVitals 返回包含所有 5 项指标的快照', () => {
    const v = getVitals();
    for (const k of ['CLS', 'FID', 'LCP', 'FCP', 'TTFB'] as const) {
      expect(v).toHaveProperty(k);
      expect(typeof v[k]).toBe('number');
    }
    // 确认是副本而非内部引用
    const v2 = getVitals();
    v2.TTFB = 999;
    expect(getVitals().TTFB).not.toBe(999);
  });

  it('observeVitals 注册回调，initVitalsMonitor 触发 TTFB 通知后可由 unsubscribe 移除', () => {
    const cb = vi.fn();
    const unsub = observeVitals(cb);

    const cleanup = initVitalsMonitor();
    expect(cleanup).toBeTypeOf('function');
    expect(cb).toHaveBeenCalled();
    expect(mockReportWebVital).toHaveBeenCalledWith('TTFB', 123.45);

    // 注销后再次触发不应再调用该回调
    cb.mockClear();
    unsub();
    initVitalsMonitor();
    expect(cb).not.toHaveBeenCalled();
  });

  it('measureFCP/LCP/CLS/FID/INP 回调体通过 fire() 逐一覆盖', () => {
    const cb = vi.fn();
    observeVitals(cb);
    initVitalsMonitor();

    const fire = (types: string[], entries: unknown[]) => {
      const obs = FakePerformanceObserver.instances.find((o) => o.entryTypes.includes(types[0]));
      expect(obs).toBeDefined();
      obs!.fire(entries);
    };

    fire(['paint'], [{ name: 'first-contentful-paint', startTime: 99.5 }]);
    fire(['largest-contentful-paint'], [{ startTime: 250.5 }]);
    fire(['layout-shift'], [{ hadRecentInput: false, value: 0.01, startTime: 100 }]);
    fire(['first-input'], [{ processingStart: 200, startTime: 150 }]);
    fire(['event'], [{ processingEnd: 300, startTime: 100 }]);

    // 各指标均被上报
    expect(mockReportWebVital).toHaveBeenCalledWith('FCP', 99.5);
    expect(mockReportWebVital).toHaveBeenCalledWith('LCP', 250.5);
    expect(mockReportWebVital).toHaveBeenCalledWith('CLS', 0.01);
    expect(mockReportWebVital).toHaveBeenCalledWith('FID', 50);
    expect(mockReportWebVital).toHaveBeenCalledWith('INP', 200);
  });

  it('devTools 关闭时 initVitalsMonitor 直接返回 undefined 且不注册 observer', () => {
    mockConfig.devTools.enabled = false;
    const cb = vi.fn();
    observeVitals(cb);
    const cleanup = initVitalsMonitor();
    expect(cleanup).toBeUndefined();
    expect(cb).not.toHaveBeenCalled();
    expect(mockReportWebVital).not.toHaveBeenCalled();
  });

  it('getEntriesByType 抛错时 measureTTFB 静默失败，监控仍可初始化', () => {
    (globalThis as unknown as { performance: unknown }).performance = {
      getEntriesByType: () => {
        throw new Error('no navigation timing');
      },
    };
    expect(() => initVitalsMonitor()).not.toThrow();
  });
});
