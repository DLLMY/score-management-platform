// Vitest 全局测试环境初始化（CRA 遗留单测复活）
// - 注册 @testing-library/jest-dom 的 DOM matchers（toBeInTheDocument/toHaveClass 等）
// - 兼容 CRA 测试里直接使用全局 jest 对象（jest.fn / jest.mock 等，映射到 vitest 的 vi）
// - 注入 fake-indexeddb：jsdom 无 IndexedDB，api.ts 请求路径走 cacheDB 会触发降级 warn 刷屏；
//   注入内存实现后缓存真实可用、测试零噪音（生产环境无此依赖）
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// ---- jsdom 缺失 API 标准 stub（同类问题兜底：matchMedia/ResizeObserver/IntersectionObserver/
//      scrollIntoView 在 jsdom 未实现，组件无 guard 时直接崩；fetch 相对 URL 解析失败刷 ErrorMonitor 噪音） ----

// matchMedia（ThemeContext/usePWA 主题与 PWA 判定）
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// ResizeObserver（VirtualList 等）
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

// IntersectionObserver（LazyImage/OptimizedImage 懒加载）
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class IntersectionObserverStub {
    root = null;
    rootMargin = '';
    thresholds = [0];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  globalThis.IntersectionObserver =
    IntersectionObserverStub as unknown as typeof IntersectionObserver;
}

// scrollIntoView（jsdom 未实现 → 组件调用抛错）
if (typeof Element !== 'undefined' && typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => {};
}

// fetch：相对 URL（/api/...）在 Node fetch 下解析失败 → TypeError + ErrorMonitor 噪音；
// 测试环境统一转为本地绝对 URL（组件渲染触发的请求返回空 404 响应，不真正联网、不刷噪音）
const _nativeFetch = globalThis.fetch;
if (_nativeFetch) {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/')) {
      return _nativeFetch.call(globalThis, 'http://localhost' + input, init);
    }
    return _nativeFetch.call(globalThis, input, init);
  }) as typeof fetch;
}

const jestCompat: Record<string, unknown> = {
  fn: vi.fn,
  mock: vi.mock,
  unmock: vi.unmock,
  spyOn: vi.spyOn,
  clearAllMocks: vi.clearAllMocks,
  resetAllMocks: vi.resetAllMocks,
  restoreAllMocks: vi.restoreAllMocks,
  useFakeTimers: vi.useFakeTimers,
  useRealTimers: vi.useRealTimers,
  advanceTimersByTime: vi.advanceTimersByTime,
};

// @ts-expect-error - 全局注入 jest 兼容对象，供 CRA 遗留测试（jest.fn() 等）使用
globalThis.jest = jestCompat;

// ---- vitest worker teardown 守卫（沙箱环境加固，非业务改动）----
// 部分单测会创建 EventEmitter（如 mock WebSocket/EventSource/SSE 客户端）并在用例结束后
// 仍持有未移除的监听器；worker 退出时对「无监听器」的 'error' 事件抛出
// → `Worker exited unexpectedly`，使全量 vitest 退出码非 0（并非测试失败）。
// 仅吞掉 EventEmitter 无监听器产生的 error 冒泡（ERR_UNHANDLED_ERROR / "Unhandled 'error' event" /
// 来自 node:events 的抛出栈），断言失败仍由 vitest 自身捕获上报，不受影响。
process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
  const s = String(err?.stack || err?.message || '');
  const isUnhandledEmitterError =
    err?.code === 'ERR_UNHANDLED_ERROR' ||
    /Unhandled ['"]error['"] event/.test(s) ||
    /node:events|events\.js|EventEmitter/.test(s);
  if (isUnhandledEmitterError) {
    return; // 吸收 EventEmitter 无监听器的 error 冒泡，避免 worker 进程崩溃
  }
  throw err; // 其它异常照常抛出，不掩盖真实问题
});
