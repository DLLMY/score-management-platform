import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import KeyboardShortcutHelp from '../KeyboardShortcutHelp';

describe('KeyboardShortcutHelp', () => {
  it('渲染隐藏的触发按钮（data-help-trigger）', () => {
    render(<KeyboardShortcutHelp />);
    const trigger = screen.getByLabelText('键盘快捷键帮助');
    expect(trigger).not.toBeNull();
    expect(trigger.getAttribute('data-help-trigger')).not.toBeNull();
    // 默认关闭，无 dialog
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('点击触发按钮 → 打开帮助面板并渲染全部快捷键', () => {
    render(<KeyboardShortcutHelp />);
    fireEvent.click(screen.getByLabelText('键盘快捷键帮助'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain('键盘快捷键');
    expect(dialog.textContent).toContain('Esc');
    expect(dialog.textContent).toContain('Shift + ?');
    expect(dialog.textContent).toContain('Ctrl/⌘ + K');
  });

  it('点击关闭按钮 → 面板关闭', () => {
    render(<KeyboardShortcutHelp />);
    fireEvent.click(screen.getByLabelText('键盘快捷键帮助'));
    expect(screen.getByRole('dialog')).not.toBeNull();
    fireEvent.click(screen.getByLabelText('关闭帮助'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('点击遮罩（dialog 本身）→ 关闭面板', () => {
    render(<KeyboardShortcutHelp />);
    fireEvent.click(screen.getByLabelText('键盘快捷键帮助'));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('点击内容区（stopPropagation）→ 面板保持打开', () => {
    render(<KeyboardShortcutHelp />);
    fireEvent.click(screen.getByLabelText('键盘快捷键帮助'));
    const dialog = screen.getByRole('dialog');
    const heading = dialog.querySelector('h2');
    expect(heading).not.toBeNull();
    fireEvent.click(heading as HTMLElement);
    expect(screen.getByRole('dialog')).not.toBeNull();
  });
});
