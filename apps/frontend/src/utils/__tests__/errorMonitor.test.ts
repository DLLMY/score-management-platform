/* eslint-disable no-console */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorMonitor } from '../errorMonitor';

const { mockPerfReportError } = vi.hoisted(() => ({ mockPerfReportError: vi.fn() }));

vi.mock('../../services/performanceReportingService', () => ({
  performanceReportingService: { reportError: mockPerfReportError },
}));
vi.mock('../../config/env', () => ({ isDevelopment: true }));

type PrivateMonitor = {
  recentlyReported: Map<string, number>;
  isReporting: boolean;
  ignoredErrors: Set<string>;
};

const priv = errorMonitor as unknown as PrivateMonitor;

describe('ErrorMonitor · reportError 核心', () => {
  beforeEach(() => {
    mockPerfReportError.mockClear();
    mockPerfReportError.mockImplementation(() => undefined);
    priv.recentlyReported.clear();
    priv.isReporting = false;
    errorMonitor.resetErrorCount();
  });

  it('正常上报：转交 performanceReportingService 并累加计数', () => {
    errorMonitor.reportError({ type: 'api_error', message: 'boom', stack: 'st' });
    expect(mockPerfReportError).toHaveBeenCalledTimes(1);
    expect(mockPerfReportError).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'api_error', message: 'boom', stack: 'st' })
    );
    expect(errorMonitor.getErrorCount()).toBe(1);
  });

  it('30s 去重窗口内同 key 只上报一次', () => {
    errorMonitor.reportError({ type: 'api_error', message: 'same', url: '/api/x' });
    errorMonitor.reportError({ type: 'api_error', message: 'same', url: '/api/x' });
    expect(mockPerfReportError).toHaveBeenCalledTimes(1);
    expect(errorMonitor.getErrorCount()).toBe(1);
  });

  it('去重窗口过期（>30s）后可再次上报', () => {
    vi.useFakeTimers();
    try {
      errorMonitor.reportError({ type: 'api_error', message: 'dup' });
      errorMonitor.reportError({ type: 'api_error', message: 'dup' });
      expect(mockPerfReportError).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(31000);
      errorMonitor.reportError({ type: 'api_error', message: 'dup' });
      expect(mockPerfReportError).toHaveBeenCalledTimes(2);
      expect(errorMonitor.getErrorCount()).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('去重 map 超过 200 条时清理过期 key', () => {
    vi.useFakeTimers();
    try {
      const now = Date.now();
      for (let i = 0; i < 205; i++) {
        priv.recentlyReported.set(`old-${i}`, now - 40000);
      }
      expect(priv.recentlyReported.size).toBe(205);

      errorMonitor.reportError({ type: 'api_error', message: 'trigger-cleanup' });
      // 过期 key 被清理，只剩本次新写入的 1 条
      expect(priv.recentlyReported.size).toBe(1);
      expect(mockPerfReportError).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('单次会话超过 50 条后停止上报', () => {
    for (let i = 0; i < 50; i++) {
      errorMonitor.reportError({ type: 'bulk', message: `msg-${i}` });
    }
    expect(errorMonitor.getErrorCount()).toBe(50);
    expect(mockPerfReportError).toHaveBeenCalledTimes(50);

    errorMonitor.reportError({ type: 'bulk', message: 'overflow' });
    expect(mockPerfReportError).toHaveBeenCalledTimes(50);
    expect(errorMonitor.getErrorCount()).toBe(50);

    // 计数重置后恢复上报能力
    errorMonitor.resetErrorCount();
    expect(errorMonitor.getErrorCount()).toBe(0);
  });

  it('重入保护：上报处理中再次 reportError 被短路（防递归）', () => {
    mockPerfReportError.mockImplementation(() => {
      errorMonitor.reportError({ type: 'inner', message: 'inner-msg' });
    });
    errorMonitor.reportError({ type: 'outer', message: 'outer-msg' });
    expect(mockPerfReportError).toHaveBeenCalledTimes(1);
    expect(errorMonitor.getErrorCount()).toBe(1);
  });
});

describe('ErrorMonitor · 便捷上报方法', () => {
  beforeEach(() => {
    mockPerfReportError.mockClear();
    mockPerfReportError.mockImplementation(() => undefined);
    priv.recentlyReported.clear();
    priv.isReporting = false;
    errorMonitor.resetErrorCount();
  });

  it('reportApiError 组装 api_error', () => {
    errorMonitor.reportApiError('/api/users', 'GET', 500, 'Internal');
    expect(mockPerfReportError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'api_error',
        message: 'Internal',
        url: '/api/users',
        method: 'GET',
        status: 500,
      })
    );
  });

  it('reportReactError 优先使用 componentStack', () => {
    const err = new Error('render failed');
    err.stack = 'err-stack';
    errorMonitor.reportReactError(err, { componentStack: 'component-stack' });
    expect(mockPerfReportError).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'react_error', message: 'render failed' })
    );
    expect(mockPerfReportError.mock.calls[0][0].stack).toBe('component-stack');
  });

  it('reportReactError 无 componentStack 时回退 error.stack', () => {
    const err = new Error('render failed');
    err.stack = 'err-stack';
    errorMonitor.reportReactError(err, {});
    expect(mockPerfReportError.mock.calls[0][0].stack).toBe('err-stack');
  });

  it('reportValidationError 组装 field: message 与上下文', () => {
    errorMonitor.reportValidationError('phone', '格式不正确', { component: 'UserForm' });
    expect(mockPerfReportError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'validation_error',
        message: 'phone: 格式不正确',
        data: { field: 'phone', context: { component: 'UserForm' } },
      })
    );
  });

  it('reportValidationError 无 context 时 data.context 为 undefined', () => {
    errorMonitor.reportValidationError('name', '必填');
    expect(mockPerfReportError.mock.calls[0][0].data).toEqual({
      field: 'name',
      context: undefined,
    });
  });

  it('reportNetworkError 组装 network_error', () => {
    const err = new Error('offline');
    err.stack = 'net-stack';
    errorMonitor.reportNetworkError('/api/devices', err);
    expect(mockPerfReportError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'network_error',
        message: 'offline',
        url: '/api/devices',
        stack: 'net-stack',
      })
    );
  });
});

describe('ErrorMonitor · 忽略名单', () => {
  beforeEach(() => {
    mockPerfReportError.mockClear();
    mockPerfReportError.mockImplementation(() => undefined);
    priv.recentlyReported.clear();
    priv.isReporting = false;
    errorMonitor.resetErrorCount();
  });

  it('addIgnoredError 后 console.error 不再上报，removeIgnoredError 后恢复', () => {
    const ignored = 'ignored-noise-message';
    errorMonitor.addIgnoredError(ignored);
    expect(priv.ignoredErrors.has(ignored)).toBe(true);

    console.error(ignored);
    expect(mockPerfReportError).not.toHaveBeenCalled();

    errorMonitor.removeIgnoredError(ignored);
    expect(priv.ignoredErrors.has(ignored)).toBe(false);

    console.error(ignored);
    expect(mockPerfReportError).toHaveBeenCalledTimes(1);
    expect(mockPerfReportError).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'console_error', message: ignored })
    );
  });
});

describe('ErrorMonitor · 全局钩子', () => {
  // ErrorMonitor 在模块加载期已覆写 window.onerror；TS 仍认为其可为 null，
  // 这里统一经断言后的句柄调用，避免在每个用例重复非空断言。
  const invokeOnError = (
    message: string,
    source: string,
    lineno: number,
    colno: number,
    error: Error
  ): boolean =>
    (window.onerror as unknown as (...args: unknown[]) => boolean)(
      message,
      source,
      lineno,
      colno,
      error
    );

  beforeEach(() => {
    mockPerfReportError.mockClear();
    mockPerfReportError.mockImplementation(() => undefined);
    priv.recentlyReported.clear();
    priv.isReporting = false;
    errorMonitor.resetErrorCount();
    errorMonitor.removeIgnoredError('global-boom');
    errorMonitor.removeIgnoredError('rejection-boom');
  });
  afterEach(() => {
    errorMonitor.removeIgnoredError('global-boom');
    errorMonitor.removeIgnoredError('rejection-boom');
  });

  it('window.onerror 全局错误上报 global_error', () => {
    const err = new Error('kaboom');
    err.stack = 'global-stack';
    const result = invokeOnError('global-boom', 'app.js', 12, 34, err);
    expect(mockPerfReportError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'global_error',
        message: 'global-boom',
        file: 'app.js',
        line: 12,
        column: 34,
        stack: 'global-stack',
      })
    );
    // 无原始 handler 时返回 false
    expect(result).toBe(false);
  });

  it('window.onerror 命中忽略名单时不上报', () => {
    errorMonitor.addIgnoredError('global-boom');
    invokeOnError('global-boom', 'app.js', 1, 2, new Error('x'));
    expect(mockPerfReportError).not.toHaveBeenCalled();
  });

  it('unhandledrejection 上报 unhandled_rejection（Error reason）', () => {
    const err = new Error('rejection-boom');
    err.stack = 'rej-stack';
    const evt = new Event('unhandledrejection') as Event & { reason?: unknown };
    evt.reason = err;
    window.dispatchEvent(evt);

    expect(mockPerfReportError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'unhandled_rejection',
        message: 'rejection-boom',
        stack: 'rej-stack',
      })
    );
  });

  it('unhandledrejection 非 Error reason 走 String 兜底', () => {
    const evt = new Event('unhandledrejection') as Event & { reason?: unknown };
    evt.reason = 'plain-string-reason';
    window.dispatchEvent(evt);

    expect(mockPerfReportError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'unhandled_rejection',
        message: 'plain-string-reason',
        stack: undefined,
      })
    );
  });

  it('unhandledrejection 命中忽略名单时不上报', () => {
    errorMonitor.addIgnoredError('rejection-boom');
    const evt = new Event('unhandledrejection') as Event & { reason?: unknown };
    evt.reason = new Error('rejection-boom');
    window.dispatchEvent(evt);
    expect(mockPerfReportError).not.toHaveBeenCalled();
  });

  it('console.error 钩子：Error 实例取 message 与 stack', () => {
    const err = new Error('console-boom');
    err.stack = 'console-stack';
    console.error('前缀:', err);
    expect(mockPerfReportError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'console_error',
        message: '前缀: console-boom',
        stack: 'console-stack',
      })
    );
  });

  it('console.error 钩子：普通对象走 JSON.stringify', () => {
    console.error({ code: 500, msg: 'failed' });
    expect(mockPerfReportError).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'console_error',
        message: '{"code":500,"msg":"failed"}',
      })
    );
  });

  it('console.error 钩子：循环引用对象走 String 兜底', () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    console.error(circular);
    expect(mockPerfReportError).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'console_error', message: '[object Object]' })
    );
  });

  it('console.error 钩子：含 [ErrorMonitor] 的自打印不再二次上报', () => {
    console.error('[ErrorMonitor] [api_error] already reported');
    expect(mockPerfReportError).not.toHaveBeenCalled();
  });

  it('console.error 钩子：上报处理中（isReporting）不再触发新的上报', () => {
    mockPerfReportError.mockImplementation(() => {
      console.error('nested-error');
    });
    errorMonitor.reportError({ type: 'outer', message: 'outer-boom' });
    expect(mockPerfReportError).toHaveBeenCalledTimes(1);
    expect(mockPerfReportError.mock.calls[0][0].type).toBe('outer');
  });
});
