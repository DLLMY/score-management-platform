/**
 * 键盘快捷键帮助面板
 * - data-help-modal：全局快捷键 `Shift+?`（useGlobalKeyboardShortcuts）点击此元素打开。
 * - Header 右上角 ? 按钮（data-help-trigger）也可打开，提升可发现性。
 */
import React, { useCallback, useState } from 'react';

interface ShortcutItem {
  keys: string;
  desc: string;
}

const SHORTCUTS: ShortcutItem[] = [
  { keys: 'Esc', desc: '关闭当前弹窗' },
  { keys: 'Shift + ?', desc: '打开本帮助面板' },
  { keys: 'Ctrl/⌘ + K', desc: '聚焦搜索框' },
  { keys: 'J / K', desc: '审批列表：上 / 下移动（选中行）' },
  { keys: 'Y / N', desc: '审批列表：通过 / 拒绝当前行' },
  { keys: 'Tab / Enter', desc: '成绩录入：保存并跳到下一格' },
  { keys: '↑ / ↓', desc: '成绩录入：切换到相邻学生同科目' },
  { keys: '粘贴', desc: '成绩录入：Excel 多列/多行批量填充' },
];

const KeyboardShortcutHelp: React.FC = () => {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      {/* 全局快捷键触达点（Shift+? / 帮助按钮） */}
      <button
        data-help-modal
        data-help-trigger
        aria-label='键盘快捷键帮助'
        className='hidden'
        onClick={() => setOpen((v) => !v)}
      />

      {open && (
        <div
          className='fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4'
          onClick={close}
          role='dialog'
          aria-modal='true'
          aria-label='键盘快捷键帮助'
        >
          <div
            className='modal-content w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='mb-4 flex items-center justify-between'>
              <h2 className='text-base font-semibold text-gray-900 dark:text-slate-100'>
                键盘快捷键
              </h2>
              <button
                onClick={close}
                className='rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-700'
                aria-label='关闭帮助'
              >
                <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                  <path d='M18 6L6 18M6 6l12 12' />
                </svg>
              </button>
            </div>
            <div className='divide-y divide-gray-100 dark:divide-slate-700'>
              {SHORTCUTS.map((s) => (
                <div
                  key={s.keys}
                  className='flex items-center justify-between gap-4 py-2.5'
                >
                  <span className='text-sm text-gray-600 dark:text-slate-300'>{s.desc}</span>
                  <kbd className='shrink-0 rounded border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-xs text-gray-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200'>
                    {s.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default KeyboardShortcutHelp;
