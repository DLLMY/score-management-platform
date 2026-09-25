import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useUndoRedo } from '../useUndoRedo';

describe('useUndoRedo', () => {
  it('addOperation / canUndo / 通知可见 / clearHistory', () => {
    const { result } = renderHook(() => useUndoRedo({ autoHideDelay: 100000 }));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);

    act(() =>
      result.current.addOperation({
        type: 'create',
        description: 'add',
        undo: vi.fn(),
      })
    );
    expect(result.current.history.length).toBe(1);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.visibleNotifications.size).toBe(1);

    act(() => result.current.clearHistory());
    expect(result.current.history.length).toBe(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.visibleNotifications.size).toBe(0);
  });

  it('undo：调用 operation.undo 并回退当前位置', async () => {
    const undoFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useUndoRedo({ autoHideDelay: 100000 }));
    act(() =>
      result.current.addOperation({
        type: 'update',
        description: 'u',
        undo: undoFn,
      })
    );
    expect(result.current.currentPosition).toBe(0);
    await act(async () => {
      await result.current.undo();
    });
    expect(undoFn).toHaveBeenCalled();
    expect(result.current.currentPosition).toBe(-1);
  });

  it('redo：撤销后可重做，调用 operation.redo', async () => {
    const undoFn = vi.fn().mockResolvedValue(undefined);
    const redoFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useUndoRedo({ autoHideDelay: 100000 }));
    act(() =>
      result.current.addOperation({
        type: 'delete',
        description: 'd',
        undo: undoFn,
        redo: redoFn,
      })
    );
    await act(async () => {
      await result.current.undo();
    });
    expect(result.current.currentPosition).toBe(-1);
    expect(result.current.canRedo).toBe(true);
    await act(async () => {
      await result.current.redo();
    });
    expect(redoFn).toHaveBeenCalled();
    expect(result.current.currentPosition).toBe(0);
  });

  it('undo 在空历史时无副作用', async () => {
    const { result } = renderHook(() => useUndoRedo());
    await act(async () => {
      await result.current.undo();
    });
    expect(result.current.currentPosition).toBe(-1);
  });
});
