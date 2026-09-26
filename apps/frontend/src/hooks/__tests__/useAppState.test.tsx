import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAppState } from '../useAppState';

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock('../../utils/logger', () => ({ default: mockLogger }));

describe('useAppState · loading/pending', () => {
  it('初始状态：空 loading、isGlobalLoading=false、无 pending', () => {
    const { result } = renderHook(() => useAppState());
    expect(result.current.loadingStates).toEqual([]);
    expect(result.current.isGlobalLoading).toBe(false);
    expect(result.current.pendingOperations).toEqual({});
  });

  it('addLoading：新增去重；global 类型触发 isGlobalLoading', () => {
    const { result } = renderHook(() => useAppState());
    act(() => result.current.addLoading('a', 'loading a', 'local'));
    expect(result.current.loadingStates).toHaveLength(1);
    act(() => result.current.addLoading('a', 'again')); // 去重
    expect(result.current.loadingStates).toHaveLength(1);
    act(() => result.current.addLoading('g', 'global', 'global'));
    expect(result.current.isGlobalLoading).toBe(true);
  });

  it('removeLoading：移除后重算 isGlobalLoading', () => {
    const { result } = renderHook(() => useAppState());
    act(() => result.current.addLoading('g', 'global', 'global'));
    expect(result.current.isGlobalLoading).toBe(true);
    act(() => result.current.removeLoading('g'));
    expect(result.current.isGlobalLoading).toBe(false);
    expect(result.current.loadingStates).toHaveLength(0);
  });

  it('setPending/isPending：默认 false，设置后可读', () => {
    const { result } = renderHook(() => useAppState());
    expect(result.current.isPending('k')).toBe(false);
    act(() => result.current.setPending('k', true));
    expect(result.current.isPending('k')).toBe(true);
    act(() => result.current.setPending('k', false));
    expect(result.current.isPending('k')).toBe(false);
  });
});

describe('useAppState · debounce/throttle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('debounce：先 clear 旧计时器再设新；延迟后执行', () => {
    const { result } = renderHook(() => useAppState());
    const fn = vi.fn();
    const d1 = result.current.debounce('k', fn, 100);
    d1();
    const d2 = result.current.debounce('k', fn, 100); // 第二次应 clear 第一次计时器
    d2();
    expect(fn).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(99));
    expect(fn).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throttle：区间内只执行一次；limit 后重置可再执行', () => {
    const { result } = renderHook(() => useAppState());
    const fn = vi.fn();
    const t = result.current.throttle('k', fn, 100);
    act(() => t('a'));
    act(() => t('b')); // 区间內被节流
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith('a');
    act(() => vi.advanceTimersByTime(100));
    act(() => t('c'));
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('c');
  });
});

describe('useAppState · wrapAsync', () => {
  beforeEach(() => mockLogger.error.mockClear());

  it('成功：addLoading→执行→onSuccess→返回结果→removeLoading', async () => {
    const { result } = renderHook(() => useAppState());
    const onSuccess = vi.fn();
    const asyncFn = vi.fn().mockResolvedValue('ok');
    let res: unknown;
    await act(async () => {
      res = await result.current.wrapAsync('id', asyncFn, { onSuccess });
    });
    expect(res).toBe('ok');
    expect(asyncFn).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith('ok');
    expect(result.current.loadingStates).toHaveLength(0);
  });

  it('失败且提供 onError：rollback→onError→返回 null→removeLoading', async () => {
    const { result } = renderHook(() => useAppState());
    const onError = vi.fn();
    const rollback = vi.fn();
    const asyncFn = vi.fn().mockRejectedValue(new Error('fail'));
    let res: unknown;
    await act(async () => {
      res = await result.current.wrapAsync('id', asyncFn, { onError, rollbackUpdate: rollback });
    });
    expect(res).toBeNull();
    expect(rollback).toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(result.current.loadingStates).toHaveLength(0);
  });

  it('失败且无 onError：rollback→logger.error→返回 null', async () => {
    const { result } = renderHook(() => useAppState());
    const rollback = vi.fn();
    const asyncFn = vi.fn().mockRejectedValue(new Error('fail2'));
    let res: unknown;
    await act(async () => {
      res = await result.current.wrapAsync('id', asyncFn, { rollbackUpdate: rollback });
    });
    expect(res).toBeNull();
    expect(rollback).toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('optimisticUpdate：在 asyncFn 之前执行', async () => {
    const { result } = renderHook(() => useAppState());
    const order: string[] = [];
    const optimisticUpdate = vi.fn(() => order.push('optimistic'));
    const asyncFn = vi.fn(() => {
      order.push('async');
      return Promise.resolve(1);
    });
    await act(async () => {
      await result.current.wrapAsync('id', asyncFn, { optimisticUpdate });
    });
    expect(order).toEqual(['optimistic', 'async']);
  });
});

describe('useAppState · 卸载清理', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('卸载时清除 debounce 计时器（fn 不执行）', () => {
    const { result, unmount } = renderHook(() => useAppState());
    const fn = vi.fn();
    const d = result.current.debounce('k', fn, 100);
    d();
    unmount();
    act(() => vi.advanceTimersByTime(100));
    expect(fn).not.toHaveBeenCalled();
  });
});
