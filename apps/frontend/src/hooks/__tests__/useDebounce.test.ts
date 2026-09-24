import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedValue, useThrottledCallback } from '../useDebouncedValue';

describe('useDebouncedValue · 防抖值', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('初始值立即生效', () => {
    const { result } = renderHook((v: string) => useDebouncedValue(v, 300), {
      initialProps: 'a',
    });
    expect(result.current).toBe('a');
  });

  it('值变化后延迟 delay 才更新', () => {
    const { result, rerender } = renderHook((v: string) => useDebouncedValue(v, 300), {
      initialProps: 'a',
    });
    rerender('b');
    expect(result.current).toBe('a'); // 尚未到延迟
    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe('a');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('b');
  });

  it('连续变化只取最后一次（重置计时器）', () => {
    const { result, rerender } = renderHook((v: string) => useDebouncedValue(v, 300), {
      initialProps: 'a',
    });
    rerender('b');
    act(() => vi.advanceTimersByTime(200));
    rerender('c');
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe('a'); // b 被 c 重置
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe('c');
  });
});

describe('useThrottledCallback · 节流回调', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('interval 内只触发一次，尾部补齐最新调用', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(cb, 300));
    act(() => result.current('a'));
    act(() => result.current('b'));
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenLastCalledWith('a');
    act(() => vi.advanceTimersByTime(300));
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenLastCalledWith('b');
  });

  it('超过 interval 后立即可再次触发', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(cb, 300));
    act(() => result.current('a'));
    expect(cb).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(300));
    act(() => result.current('b'));
    expect(cb).toHaveBeenCalledTimes(2);
  });
});
