import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BatchImportModal } from './BatchImportModal';
import type { NLPDeps } from './types';

function makeDeps(overrides: Record<string, unknown> = {}): NLPDeps {
  const base = {
    setShowBatchImportModal: vi.fn(),
    setImportFile: vi.fn(),
    setImportJsonText: vi.fn(),
    importFile: null,
    importJsonText: '',
    handleDownloadTemplate: vi.fn(),
    handleBatchImport: vi.fn(),
    isImporting: false,
  };
  return { ...base, ...overrides } as unknown as NLPDeps;
}

describe('BatchImportModal 渲染与分支覆盖 B58冲刺', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('关闭(X) 触发 setShowBatchImportModal(false)+setImportFile(null)+setImportJsonText("")', () => {
    const deps = makeDeps();
    render(<BatchImportModal deps={deps} />);
    const closeBtn = screen
      .getAllByRole('button')
      .find((b) => (b.textContent || '').trim() === '') as HTMLButtonElement;
    fireEvent.click(closeBtn);
    expect(deps.setShowBatchImportModal).toHaveBeenCalledWith(false);
    expect(deps.setImportFile).toHaveBeenCalledWith(null);
    expect(deps.setImportJsonText).toHaveBeenCalledWith('');
  });

  it('上传文件：onChange 派发 setImportFile(文件) + setImportJsonText("")', () => {
    const deps = makeDeps();
    render(<BatchImportModal deps={deps} />);
    const file = new File(['{}'], 'rules.json', { type: 'application/json' });
    const input = document.getElementById('import-file') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(deps.setImportFile).toHaveBeenCalledWith(file);
    expect(deps.setImportJsonText).toHaveBeenCalledWith('');
  });

  it('importFile 有值时显示文件名；无值时不显示', () => {
    const { unmount } = render(
      <BatchImportModal deps={makeDeps({ importFile: { name: 'a.json' } })} />
    );
    expect(screen.getByText('a.json')).toBeInTheDocument();
    unmount();
    render(<BatchImportModal deps={makeDeps({ importFile: null })} />);
    expect(screen.queryByText('a.json')).toBeNull();
  });

  it('下载模板按钮触发 handleDownloadTemplate', () => {
    const deps = makeDeps();
    render(<BatchImportModal deps={deps} />);
    fireEvent.click(screen.getByText('下载模板'));
    expect(deps.handleDownloadTemplate).toHaveBeenCalledTimes(1);
  });

  it('直接输入 JSON：onChange 派发 setImportJsonText(值) + setImportFile(null)', () => {
    const deps = makeDeps();
    render(<BatchImportModal deps={deps} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '[{"a":1}]' } });
    expect(deps.setImportJsonText).toHaveBeenCalledWith('[{"a":1}]');
    expect(deps.setImportFile).toHaveBeenCalledWith(null);
  });

  it('取消触发 setShowBatchImportModal(false)+setImportFile(null)+setImportJsonText("")', () => {
    const deps = makeDeps();
    render(<BatchImportModal deps={deps} />);
    fireEvent.click(screen.getByText('取消'));
    expect(deps.setShowBatchImportModal).toHaveBeenCalledWith(false);
    expect(deps.setImportFile).toHaveBeenCalledWith(null);
    expect(deps.setImportJsonText).toHaveBeenCalledWith('');
  });

  it('开始导入按钮触发 handleBatchImport', () => {
    const deps = makeDeps();
    render(<BatchImportModal deps={deps} />);
    fireEvent.click(screen.getByText('开始导入'));
    expect(deps.handleBatchImport).toHaveBeenCalledTimes(1);
  });

  it('isImporting=true -> 按钮 disabled 且文案「导入中...」', () => {
    render(<BatchImportModal deps={makeDeps({ isImporting: true })} />);
    const btn = screen.getByText('导入中...').closest('button') as HTMLButtonElement;
    expect(btn).toBeDisabled();
    expect(screen.queryByText('开始导入')).toBeNull();
  });
});
