import { describe, it, expect, beforeEach, vi } from 'vitest';

// errorMonitor 去重节流单测：同错误 30s 窗口内只上报一次（防轮询风暴刷屏）
describe('errorMonitor dedupe', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('同错误 30s 窗口内去重', async () => {
    const reportSpy = vi.fn();
    // 注入 reportError 探针：通过 mock performanceReportingService 观察上报次数
    vi.doMock('../../services/performanceReportingService', () => ({
      performanceReportingService: {
        reportError: reportSpy,
      },
    }));

    const { errorMonitor } = await import('../../utils/errorMonitor');
    // 构造同 key 错误（同 type/url/method/status/message）
    const err1 = {
      type: 'api_error',
      message: '请求超时，请检查网络或稍后重试',
      url: '/api/devices',
      method: 'GET',
      status: 504,
    };
    const err2 = {
      type: 'api_error',
      message: '请求超时，请检查网络或稍后重试',
      url: '/api/devices',
      method: 'GET',
      status: 504,
    };

    errorMonitor.reportError(err1 as never);
    errorMonitor.reportError(err2 as never); // 30s 内重复 → 去重跳过

    expect(reportSpy).toHaveBeenCalledTimes(1);
  });

  it('不同错误不被去重', async () => {
    const reportSpy = vi.fn();
    vi.doMock('../../services/performanceReportingService', () => ({
      performanceReportingService: { reportError: reportSpy },
    }));

    const { errorMonitor } = await import('../../utils/errorMonitor');
    errorMonitor.reportError({
      type: 'api_error',
      message: '超时A',
      url: '/api/a',
      method: 'GET',
      status: 504,
    } as never);
    errorMonitor.reportError({
      type: 'api_error',
      message: '超时B',
      url: '/api/b',
      method: 'GET',
      status: 504,
    } as never);

    expect(reportSpy).toHaveBeenCalledTimes(2);
  });

  it('去重窗口过期后可再次上报', async () => {
    const reportSpy = vi.fn();
    vi.doMock('../../services/performanceReportingService', () => ({
      performanceReportingService: { reportError: reportSpy },
    }));

    const { errorMonitor } = await import('../../utils/errorMonitor');
    errorMonitor.reportError({
      type: 'api_error',
      message: '超时',
      url: '/api/devices',
      method: 'GET',
      status: 504,
    } as never);

    // 模拟时间前进 31s，绕过去重窗口
    vi.useFakeTimers();
    vi.advanceTimersByTime(31000);
    errorMonitor.reportError({
      type: 'api_error',
      message: '超时',
      url: '/api/devices',
      method: 'GET',
      status: 504,
    } as never);
    vi.useRealTimers();

    expect(reportSpy).toHaveBeenCalledTimes(2);
  });
});
