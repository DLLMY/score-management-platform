import { renderHook, act } from '@testing-library/react';
import { useOptimisticUpdate } from '../../hooks/useOptimisticUpdate';

interface State {
  a: number;
  b: number;
}

describe('useOptimisticUpdate (M10 回滚边界)', () => {
  test('batchUpdate 部分失败：保留已成功的兄弟项，仅回滚失败项', async () => {
    const initial: State = { a: 0, b: 0 };
    const { result } = renderHook(() => useOptimisticUpdate<State>());

    act(() => result.current.setData(initial));

    await act(async () => {
      await result.current.batchUpdate([
        {
          id: 'A',
          updateFn: (d) => ({ ...d, a: d.a + 1 }),
          asyncFn: async () => ({ a: 1, b: 0 }),
        },
        {
          id: 'B',
          updateFn: (d) => ({ ...d, b: d.b + 1 }),
          asyncFn: async () => {
            throw new Error('B failed');
          },
        },
      ]);
    });

    // M10 修复前：rollbackUpdate 会把整个 data 恢复为批次初快照 {a:0,b:0}，
    // 导致已成功的 A 也被撤销。修复后应保留 A、仅回滚 B。
    expect(result.current.data).toEqual({ a: 1, b: 0 });
    // batchUpdate 对单项失败仅回滚、不 setError（error 仅用于整批抛错），属既有设计
    expect(result.current.error).toBeNull();
    expect(result.current.hasPendingUpdates).toBe(false);
  });

  test('performUpdate 单条失败：整体回退到初始已提交状态', async () => {
    const initial: State = { a: 0, b: 0 };
    const { result } = renderHook(() => useOptimisticUpdate<State>());

    act(() => result.current.setData(initial));

    await act(async () => {
      await result.current.performUpdate(
        'X',
        (d) => ({ ...d, a: d.a + 1 }),
        async () => {
          throw new Error('X failed');
        }
      );
    });

    expect(result.current.data).toEqual({ a: 0, b: 0 });
    expect(result.current.error?.message).toBe('X failed');
  });

  test('batchUpdate 全部成功：不触发误回滚，保留已提交结果', async () => {
    const initial: State = { a: 0, b: 0 };
    const { result } = renderHook(() => useOptimisticUpdate<State>());

    act(() => result.current.setData(initial));

    await act(async () => {
      await result.current.batchUpdate([
        {
          id: 'A',
          updateFn: (d) => ({ ...d, a: d.a + 1 }),
          asyncFn: async () => ({ a: 1, b: 0 }),
        },
        {
          id: 'B',
          updateFn: (d) => ({ ...d, b: d.b + 1 }),
          asyncFn: async () => ({ a: 1, b: 1 }),
        },
      ]);
    });

    // 全成功路径：A 的已提交结果被保留（不为初始 0），不误回滚
    expect(result.current.data?.a).toBe(1);
    expect(result.current.error).toBeNull();
  });
});
