import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useKeyboardShortcut, useGlobalKeyboardShortcuts } from '../useKeyboardShortcut';

describe('useKeyboardShortcut', () => {
  it('匹配 meta → action 触发且 preventDefault', () => {
    const action = vi.fn();
    renderHook(() => useKeyboardShortcut([{ key: 's', meta: true, action }]));
    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(action).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('不匹配则不触发', () => {
    const action = vi.fn();
    renderHook(() => useKeyboardShortcut([{ key: 's', meta: true, action }]));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }));
    });
    expect(action).not.toHaveBeenCalled();
  });

  it('无修饰键的快捷键：仅精确键匹配（带 shift 不匹配）', () => {
    const action = vi.fn();
    renderHook(() => useKeyboardShortcut([{ key: 'k', action }]));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
    });
    expect(action).toHaveBeenCalledTimes(1);
    action.mockClear();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', shiftKey: true }));
    });
    expect(action).not.toHaveBeenCalled();
  });

  it('preventDefault=false 时不阻止默认行为', () => {
    const action = vi.fn();
    renderHook(() =>
      useKeyboardShortcut([{ key: 'p', meta: true, preventDefault: false, action }])
    );
    const event = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(action).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('useGlobalKeyboardShortcuts', () => {
  it('Ctrl+K 聚焦 data-search-input', () => {
    const input = document.createElement('input');
    input.setAttribute('data-search-input', '');
    document.body.appendChild(input);
    const focusSpy = vi.spyOn(input, 'focus');
    renderHook(() => useGlobalKeyboardShortcuts());
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    });
    expect(focusSpy).toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('Escape：存在 modal-content 时点击最后一个 data-modal-close', () => {
    const modal = document.createElement('div');
    modal.className = 'modal-content';
    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('data-modal-close', '');
    const clickSpy = vi.spyOn(closeBtn, 'click');
    modal.appendChild(closeBtn);
    document.body.appendChild(modal);
    renderHook(() => useGlobalKeyboardShortcuts());
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(clickSpy).toHaveBeenCalled();
    document.body.removeChild(modal);
  });
});
