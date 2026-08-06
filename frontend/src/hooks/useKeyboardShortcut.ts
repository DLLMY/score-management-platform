import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  preventDefault?: boolean;
  action: (event: KeyboardEvent) => void;
  description?: string;
}

export function useKeyboardShortcut(shortcuts: KeyboardShortcut[]): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const { key, metaKey, ctrlKey, shiftKey, altKey } = event;

      shortcuts.forEach((shortcut) => {
        const matchesKey = shortcut.key.toLowerCase() === key.toLowerCase();
        const matchesMeta = !!shortcut.meta === (metaKey || ctrlKey);
        const matchesShift = !!shortcut.shift === shiftKey;
        const matchesAlt = !!shortcut.alt === altKey;

        if (matchesKey && matchesMeta && matchesShift && matchesAlt) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          shortcut.action(event);
        }
      });
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export function useGlobalKeyboardShortcuts(): void {
  useKeyboardShortcut([
    {
      key: 'Escape',
      action: () => {
        const modals = document.querySelectorAll('.modal-content');
        if (modals.length > 0) {
          const closeButtons = document.querySelectorAll('[data-modal-close]');
          if (closeButtons.length > 0) {
            (closeButtons[closeButtons.length - 1] as HTMLElement).click();
          }
        }
      },
      description: '关闭弹窗',
    },
    {
      key: '?',
      shift: true,
      action: () => {
        const helpModal = document.querySelector('[data-help-modal]');
        if (helpModal) {
          (helpModal as HTMLElement).click();
        }
      },
      description: '显示帮助',
    },
    {
      key: 'k',
      meta: true,
      action: () => {
        const searchInput = document.querySelector('[data-search-input]');
        if (searchInput) {
          (searchInput as HTMLInputElement).focus();
        }
      },
      description: '聚焦搜索框 (Cmd/Ctrl + K)',
    },
    {
      key: 'n',
      meta: true,
      action: () => {
        const addButton = document.querySelector('[data-add-button]');
        if (addButton) {
          (addButton as HTMLElement).click();
        }
      },
      description: '新建项目 (Cmd/Ctrl + N)',
    },
    {
      key: 'r',
      meta: true,
      action: () => {
        window.location.reload();
      },
      description: '刷新页面 (Cmd/Ctrl + R)',
    },
  ]);
}

export default useKeyboardShortcut;