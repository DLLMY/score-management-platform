import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useDebouncedValue, useThrottledCallback } from '../useDebouncedValue';

describe('useDebouncedValue', () => {
  it('初始值同步返回', () => {
    const { result } = renderHook(() => useDebouncedValue(1, 50));
    expect(result.current).toBe(1);
  });

  it('值变化后延迟更新（防抖）', async () => {
    const { result, rerender } = renderHook(({ v }: { v: number }) => useDebouncedValue(v, 50), {
      initialProps: { v: 1 },
    });
    rerender({ v: 2 });
    // 立刻尚未更新
    expect(result.current).toBe(1);
    await waitFor(() => expect(result.current).toBe(2));
  });
});

describe('useThrottledCallback', () => {
  it('限频触发：窗口内仅首次立即执行', () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(cb, 100));
    act(() => {
      result.current('a');
      result.current('b');
      result.current('c');
    });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith('a');
    // 窗口结束后尾调用执行（取最新参数）
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenLastCalledWith('c');
    vi.useRealTimers();
  });
});
