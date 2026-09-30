import { renderHook, act, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUndoRedo, ToastNotification } from '../useUndoRedo';

describe('useUndoRedo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('初始状态：canUndo=false, canRedo=false, history 空', () => {
    const { result } = renderHook(() => useUndoRedo());
    expect(result.current.history).toEqual([]);
    expect(result.current.currentPosition).toBe(-1);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('addOperation 追加并标记 visible，autoHide 后移除通知', () => {
    const { result } = renderHook(() => useUndoRedo());
    act(() => {
      result.current.addOperation({ type: 'create', description: '新增' });
    });
    expect(result.current.history.length).toBe(1);
    expect(result.current.currentPosition).toBe(0);
    expect(result.current.canUndo).toBe(true);
    const id = result.current.history[0].id;
    expect(result.current.visibleNotifications.has(id)).toBe(true);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.visibleNotifications.has(id)).toBe(false);
  });

  it('addOperation 受 maxHistory 截断', async () => {
    const { result } = renderHook(() => useUndoRedo({ maxHistory: 2 }));
    act(() => {
      result.current.addOperation({ type: 'create', description: 'a' });
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      result.current.addOperation({ type: 'update', description: 'b' });
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      result.current.addOperation({ type: 'delete', description: 'c' });
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.history.length).toBe(2);
    expect(result.current.history.map((h) => h.type)).toEqual(['update', 'delete']);
    expect(result.current.currentPosition).toBe(1);
  });

  it('undo 调用 operation.undo 并回退位置', async () => {
    const undo = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useUndoRedo());
    act(() => {
      result.current.addOperation({ type: 'create', description: 'x', undo });
    });
    await act(async () => {
      await result.current.undo();
    });
    expect(undo).toHaveBeenCalled();
    expect(result.current.currentPosition).toBe(-1);
  });

  it('undo 在空历史时早返回不报错', async () => {
    const { result } = renderHook(() => useUndoRedo());
    await act(async () => {
      await result.current.undo();
    });
    expect(result.current.currentPosition).toBe(-1);
  });

  it('undo 中 undo 失败时被 catch（不抛、不回退）', async () => {
    const undo = vi.fn().mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useUndoRedo());
    act(() => {
      result.current.addOperation({ type: 'create', description: 'x', undo });
    });
    await act(async () => {
      await result.current.undo();
    });
    expect(undo).toHaveBeenCalled();
    expect(result.current.currentPosition).toBe(0);
  });

  it('redo 调用 operation.redo 并前进位置', async () => {
    const undo = vi.fn().mockResolvedValue(undefined);
    const redo = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useUndoRedo());
    act(() => {
      result.current.addOperation({ type: 'create', description: 'x', undo, redo });
    });
    await act(async () => {
      await result.current.undo();
    });
    expect(result.current.currentPosition).toBe(-1);
    await act(async () => {
      await result.current.redo();
    });
    expect(redo).toHaveBeenCalled();
    expect(result.current.currentPosition).toBe(0);
  });

  it('redo 在末尾时早返回', async () => {
    const { result } = renderHook(() => useUndoRedo());
    act(() => {
      result.current.addOperation({ type: 'create', description: 'x' });
    });
    await act(async () => {
      await result.current.redo();
    });
    expect(result.current.currentPosition).toBe(0);
  });

  it('clearHistory 重置所有状态', () => {
    const { result } = renderHook(() => useUndoRedo());
    act(() => {
      result.current.addOperation({ type: 'create', description: 'x' });
    });
    act(() => {
      result.current.clearHistory();
    });
    expect(result.current.history).toEqual([]);
    expect(result.current.currentPosition).toBe(-1);
    expect(result.current.visibleNotifications.size).toBe(0);
  });
});

describe('ToastNotification', () => {
  it('成功类型渲染撤销按钮并触发 onUndo', () => {
    const onUndo = vi.fn();
    const onDismiss = vi.fn();
    render(
      <ToastNotification
        operation={{ id: '1', type: 'create', description: '新增', undo: () => {} }}
        onUndo={onUndo}
        onDismiss={onDismiss}
      />
    );
    expect(screen.getByText('新增')).toBeInTheDocument();
    const undoBtn = screen.getByRole('button', { name: /撤销/ });
    fireEvent.click(undoBtn);
    expect(onUndo).toHaveBeenCalled();
  });

  it('删除类型无撤销按钮，X 按钮触发 onDismiss', () => {
    const onDismiss = vi.fn();
    render(
      <ToastNotification
        operation={{ id: '2', type: 'delete', description: '删除' }}
        onDismiss={onDismiss}
      />
    );
    expect(screen.queryByText('撤销')).toBeNull();
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(onDismiss).toHaveBeenCalled();
  });
});
