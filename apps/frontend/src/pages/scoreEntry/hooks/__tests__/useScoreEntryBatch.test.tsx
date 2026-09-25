import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScoreEntryBatch } from '../useScoreEntryBatch';

describe('useScoreEntryBatch · 批量提交进度', () => {
  it('全部成功 → success 计数、failed 空、进度到尾', async () => {
    const { result } = renderHook(() => useScoreEntryBatch());
    const fn = vi.fn().mockResolvedValue(undefined);
    let res: { success: number; failed: Array<{ item: number; error: string }> };
    await act(async () => {
      res = await result.current.runBatched([1, 2, 3], fn);
    });
    expect(res!.success).toBe(3);
    expect(res!.failed).toEqual([]);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(result.current.batchProgress).toEqual({ processed: 3, total: 3 });
  });

  it('部分失败 → failed 记录 item 与 message', async () => {
    const { result } = renderHook(() => useScoreEntryBatch());
    const fn = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);
    let res: { success: number; failed: Array<{ item: number; error: string }> };
    await act(async () => {
      res = await result.current.runBatched([1, 2, 3], fn);
    });
    expect(res!.success).toBe(2);
    expect(res!.failed).toHaveLength(1);
    expect(res!.failed[0].item).toBe(2);
    expect(res!.failed[0].error).toContain('boom');
  });

  it('reason 非 Error → 降级为「未知错误」', async () => {
    const { result } = renderHook(() => useScoreEntryBatch());
    const fn = vi.fn().mockRejectedValueOnce('raw string');
    let res: { success: number; failed: Array<{ item: number; error: string }> };
    await act(async () => {
      res = await result.current.runBatched([1], fn);
    });
    expect(res!.success).toBe(0);
    expect(res!.failed[0].error).toBe('未知错误');
  });

  it('onBatchDone 每批触发一次（25 项 → 2 批）', async () => {
    const { result } = renderHook(() => useScoreEntryBatch());
    const fn = vi.fn().mockResolvedValue(undefined);
    const onBatchDone = vi.fn();
    await act(async () => {
      await result.current.runBatched(
        Array.from({ length: 25 }, (_, i) => i),
        fn,
        onBatchDone
      );
    });
    expect(onBatchDone).toHaveBeenCalledTimes(2);
  });

  it('分批大小 20：45 项分 3 批推进，最终进度到尾', async () => {
    const { result } = renderHook(() => useScoreEntryBatch());
    const onBatchDone = vi.fn();
    const fn = vi
      .fn()
      .mockImplementation(() => new Promise<void>((resolve) => setTimeout(resolve, 5)));
    await act(async () => {
      await result.current.runBatched(
        Array.from({ length: 45 }, (_, i) => i),
        fn,
        onBatchDone
      );
    });
    // 45 项 = 3 批(20,20,5)
    expect(onBatchDone).toHaveBeenCalledTimes(3);
    expect(result.current.batchProgress).toEqual({ processed: 45, total: 45 });
  });

  it('onCancelBatch：中途取消只处理首个批次', async () => {
    const { result } = renderHook(() => useScoreEntryBatch());
    const fn = vi
      .fn()
      .mockImplementation(() => new Promise<void>((resolve) => setTimeout(resolve, 5)));
    let res: { success: number; failed: Array<{ item: number; error: string }> };
    const p = result.current.runBatched(
      Array.from({ length: 25 }, (_, i) => i),
      fn
    );
    act(() => result.current.onCancelBatch());
    await act(async () => {
      res = await p;
    });
    // 仅第 1 批(20)被处理，第 2 批(5)被取消跳过
    expect(res!.success).toBe(20);
    expect(fn).toHaveBeenCalledTimes(20);
  });

  it('onCancelBatch 为稳定 useCallback（多次调用不报错）', () => {
    const { result } = renderHook(() => useScoreEntryBatch());
    expect(() => result.current.onCancelBatch()).not.toThrow();
    expect(() => result.current.onCancelBatch()).not.toThrow();
  });
});
