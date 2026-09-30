import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMemoryUsage } from '../useMemoryUsage';

type Mem = { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };

// jsdom 下 performance.memory 不存在（仅 Chrome 有），需手动挂载/卸载以覆盖相关分支
function setPerformanceMemory(mem: Mem | undefined) {
  if (mem === undefined) {
    delete (performance as unknown as { memory?: unknown }).memory;
  } else {
    Object.defineProperty(performance, 'memory', {
      value: mem,
      configurable: true,
      writable: true,
    });
  }
}

describe('useMemoryUsage · 浏览器 JS 堆内存监控', () => {
  afterEach(() => {
    delete (performance as unknown as { memory?: unknown }).memory;
  });

  it('enabled=false：不注册定时器，直接返回初始零值 state', () => {
    const { result } = renderHook(() => useMemoryUsage(false));
    expect(result.current).toEqual({
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0,
    });
  });

  it('enabled=true 且 performance.memory 存在：立即更新并返回真实内存值（含清理）', () => {
    setPerformanceMemory({ usedJSHeapSize: 1024, totalJSHeapSize: 2048, jsHeapSizeLimit: 4096 });
    const { result, unmount } = renderHook(() => useMemoryUsage(true));
    expect(result.current).toEqual({
      usedJSHeapSize: 1024,
      totalJSHeapSize: 2048,
      jsHeapSizeLimit: 4096,
    });
    unmount(); // 触发 clearInterval 清理路径
  });

  it('enabled=true 但 performance.memory 不存在：不更新，保持初始零值', () => {
    setPerformanceMemory(undefined);
    const { result, unmount } = renderHook(() => useMemoryUsage(true));
    expect(result.current).toEqual({
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0,
    });
    unmount();
  });

  it('performance.memory 字段为 0（falsy）：仍返回 0，覆盖 || 0 兜底右分支', () => {
    setPerformanceMemory({ usedJSHeapSize: 0, totalJSHeapSize: 0, jsHeapSizeLimit: 0 });
    const { result, unmount } = renderHook(() => useMemoryUsage(true));
    expect(result.current).toEqual({
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0,
    });
    unmount();
  });
});
