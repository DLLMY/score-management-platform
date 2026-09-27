import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  withOptimisticUpdate,
  applyOptimisticUpdates,
  generateOptimisticId,
  createOptimisticQueue,
  useOptimisticState,
  type OptimisticAction,
} from '../optimisticUpdate';

describe('optimisticUpdate 纯逻辑', () => {
  it('withOptimisticUpdate 成功路径：update→apiCall→onSuccess→返回响应', async () => {
    const update = vi.fn();
    const revert = vi.fn();
    const onSuccess = vi.fn();
    const onComplete = vi.fn();
    const apiCall = vi.fn().mockResolvedValue({ ok: true });

    const res = await withOptimisticUpdate({ v: 1 }, apiCall, {
      update,
      revert,
      onSuccess,
      onComplete,
    });

    expect(update).toHaveBeenCalledWith({ v: 1 });
    expect(apiCall).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith({ ok: true });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ ok: true });
  });

  it('withOptimisticUpdate 失败路径：revert→onError→rethrow 包装 Error', async () => {
    const update = vi.fn();
    const revert = vi.fn();
    const onError = vi.fn();
    const onComplete = vi.fn();
    const apiCall = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(
      withOptimisticUpdate({ v: 1 }, apiCall, { update, revert, onError, onComplete })
    ).rejects.toThrow('boom');

    expect(revert).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('withOptimisticUpdate 非 Error 异常被包装为 Error', async () => {
    const onError = vi.fn();
    const apiCall = vi.fn().mockRejectedValue('string-error');

    await expect(
      withOptimisticUpdate({}, apiCall, { update: () => {}, revert: () => {}, onError })
    ).rejects.toBeInstanceOf(Error);

    expect((onError.mock.calls[0][0] as Error).message).toBe('string-error');
  });

  it('applyOptimisticUpdates 用 reduce 顺序应用每个 action', () => {
    const base = { n: 0 };
    const actions: OptimisticAction<number>[] = [
      { id: '1', type: 'inc', payload: 1, timestamp: 1 },
      { id: '2', type: 'inc', payload: 2, timestamp: 2 },
    ];
    const result = applyOptimisticUpdates(base, actions, (s, a) => ({ n: s.n + a.payload }));
    expect(result).toEqual({ n: 3 });
  });

  it('generateOptimisticId 唯一且带 optimistic_ 前缀', () => {
    const a = generateOptimisticId();
    const b = generateOptimisticId();
    expect(a).toMatch(/^optimistic_/);
    expect(b).toMatch(/^optimistic_/);
    expect(a).not.toBe(b);
  });

  it('OptimisticQueue：add/resolve/reject/getPending/getAll/clear 生命周期', () => {
    const q = createOptimisticQueue<number>();
    q.add({ id: 'a', type: 't', payload: 1 });
    q.add({ id: 'b', type: 't', payload: 2 });
    expect(q.getPendingActions()).toHaveLength(2);
    expect(q.getAllActions()).toHaveLength(2);

    q.resolve('a');
    expect(q.getPendingActions()).toHaveLength(1);

    const rejected = q.reject('b');
    expect(rejected?.id).toBe('b');
    expect(q.getPendingActions()).toHaveLength(0);

    q.clear();
    expect(q.getAllActions()).toHaveLength(0);
  });

  it('OptimisticQueue 超过 maxQueueSize(100) 丢弃最旧', () => {
    const q = createOptimisticQueue<number>();
    for (let i = 0; i < 110; i++) {
      q.add({ id: String(i), type: 't', payload: i });
    }
    expect(q.getAllActions().length).toBeLessThanOrEqual(100);
    // 最旧的 0 已被丢弃
    expect(q.getAllActions().some((a) => a.id === '0')).toBe(false);
  });
});

describe('optimisticUpdate · useOptimisticState 钩子（B29 补齐）', () => {
  it('初始 state 与 isOptimistic=false', () => {
    const { result } = renderHook(() => useOptimisticState({ count: 0 }));
    expect(result.current.state).toEqual({ count: 0 });
    expect(result.current.isOptimistic).toBe(false);
  });

  it('setOptimistic 更新 state 并返回可回滚函数', () => {
    const { result } = renderHook(() => useOptimisticState<{ count: number }>({ count: 0 }));
    let rollback: () => void = () => {};
    act(() => {
      rollback = result.current.setOptimistic((prev) => ({ count: prev.count + 1 }));
    });
    expect(result.current.state).toEqual({ count: 1 });
    expect(result.current.isOptimistic).toBe(true);
    act(() => rollback());
    expect(result.current.state).toEqual({ count: 0 });
    expect(result.current.isOptimistic).toBe(false);
  });

  it('reset 回到 previousState 并清除 optimistic 标记', () => {
    const { result } = renderHook(() => useOptimisticState<{ count: number }>({ count: 0 }));
    act(() => {
      result.current.setOptimistic((p) => ({ count: p.count + 5 }));
    });
    expect(result.current.state).toEqual({ count: 5 });
    act(() => result.current.reset());
    expect(result.current.state).toEqual({ count: 0 });
    expect(result.current.isOptimistic).toBe(false);
  });
});
