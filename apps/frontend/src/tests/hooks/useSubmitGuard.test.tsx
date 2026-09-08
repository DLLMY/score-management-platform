/**
 * useSubmitGuard 测试 —— 覆盖 S9 修复的"通用提交防重 hook"（消除双击/连点导致重复创建/提交）。
 * 关键不变量：
 *  - run 在途（inFlight）时，并发第二次 run 必须被忽略（fn 仅执行一次）；
 *  - submitting 随 in-flight 切换 true/false；
 *  - fn 抛错也要在 finally 解锁，避免永久卡死提交态。
 */
import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useSubmitGuard } from '../../hooks/useSubmitGuard';

describe('useSubmitGuard', () => {
  test('run executes fn once and toggles submitting back to false', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const { result } = renderHook(() => useSubmitGuard());

    // run 是 fire-and-forget（不向上透传 fn 返回值），仅断言 fn 执行一次 + 提交态复位
    await act(async () => {
      await result.current.run(fn);
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(result.current.submitting).toBe(false);
  });

  test('ignores a concurrent second run while the first is in flight (double-submit guard)', async () => {
    let resolve: () => void = () => {};
    let calls = 0;
    const fn = vi.fn(
      () =>
        new Promise<void>((r) => {
          calls += 1;
          resolve = r;
        })
    );
    const { result } = renderHook(() => useSubmitGuard());

    let firstRun: Promise<unknown>;
    act(() => {
      firstRun = result.current.run(fn);
      result.current.run(fn); // 并发第二次：inFlight 已置位 → 必须被忽略
    });

    // fn 仅被第一次 run 调用一次；提交态为 true
    expect(calls).toBe(1);
    expect(result.current.submitting).toBe(true);

    await act(async () => {
      resolve();
      await firstRun;
    });

    // 第一次完成后解锁，fn 始终只执行一次
    expect(calls).toBe(1);
    expect(result.current.submitting).toBe(false);
  });

  test('unlocks (submitting -> false) even if fn rejects', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useSubmitGuard());

    await expect(
      act(async () => {
        await result.current.run(fn);
      })
    ).rejects.toThrow('boom');

    // finally 必须解锁，否则会永久卡在提交态
    expect(result.current.submitting).toBe(false);
  });

  test('allows a second run after the first completes', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useSubmitGuard());

    await act(async () => {
      await result.current.run(fn);
    });
    await act(async () => {
      await result.current.run(fn);
    });

    expect(fn).toHaveBeenCalledTimes(2);
    expect(result.current.submitting).toBe(false);
  });
});
