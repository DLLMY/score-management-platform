import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSubmitGuard } from '../useSubmitGuard';

describe('useSubmitGuard · 提交防重', () => {
  it('正常执行并设置 submitting 态（在途 true，完成 false）', async () => {
    const { result } = renderHook(() => useSubmitGuard());
    expect(result.current.submitting).toBe(false);

    let release!: () => void;
    const p = result.current.run(
      () => new Promise<void>((resolve) => { release = resolve; })
    );

    // 在途：act 刷新后应看到 submitting=true
    await act(async () => { await Promise.resolve(); });
    expect(result.current.submitting).toBe(true);

    await act(async () => { release(); await p; });
    expect(result.current.submitting).toBe(false);
  });

  it('并发重复调用被忽略（同一时间仅一次执行）', async () => {
    const fn = vi.fn(
      () => new Promise((resolve) => setTimeout(resolve, 20)) as Promise<unknown>
    );
    const { result } = renderHook(() => useSubmitGuard());

    const p1 = result.current.run(fn) as Promise<unknown>;
    const p2 = result.current.run(fn); // 在途，应被忽略

    expect(fn).toHaveBeenCalledTimes(1);
    await act(async () => {
      await p1;
      await p2;
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('fn 抛错仍自动解锁', async () => {
    const errFn = vi.fn(async () => {
      throw new Error('保存失败');
    });
    const { result } = renderHook(() => useSubmitGuard());

    await act(async () => {
      await expect(result.current.run(errFn)).rejects.toThrow('保存失败');
    });
    expect(result.current.submitting).toBe(false);
  });
});
