import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImportExportPanel from '../ImportExportPanel';

const hoisted = vi.hoisted(() => {
  const showToast = vi.fn();
  const downloadBlob = vi.fn();
  const downloadTextAsFile = vi.fn();
  const getAuthHeaders = vi.fn(() => ({}));
  return { showToast, downloadBlob, downloadTextAsFile, getAuthHeaders };
});

vi.mock('../../../context/ToastContext', () => ({
  useToast: () => ({ showToast: hoisted.showToast }),
}));
vi.mock('../../PermissionGuard', () => ({
  PermissionButton: ({ children, onClick, permission }: any) => (
    <button onClick={onClick} data-permission={permission}>
      {children}
    </button>
  ),
}));
vi.mock('../../../utils/download', () => ({
  downloadBlob: hoisted.downloadBlob,
  downloadTextAsFile: hoisted.downloadTextAsFile,
}));
vi.mock('../../../services/api', () => ({
  getAuthHeaders: hoisted.getAuthHeaders,
}));
vi.mock('../../ui/Modal', () => ({
  default: ({ isOpen, children }: any) =>
    isOpen ? <div data-testid='modal'>{children}</div> : null,
}));

function makeFile(name: string, type = '') {
  return new File(['x'], name, { type });
}

function selectFile(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

beforeEach(() => {
  hoisted.showToast.mockClear();
  hoisted.downloadBlob.mockClear();
  hoisted.downloadTextAsFile.mockClear();
  hoisted.getAuthHeaders.mockClear();
  vi.unstubAllGlobals();
});

describe('ImportExportPanel', () => {
  it('默认渲染导入/导出/模板三个按钮', () => {
    render(<ImportExportPanel type='user' />);
    expect(screen.getByRole('button', { name: /导入用户数据/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /导出用户数据 \(Excel\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /下载导入模板/ })).toBeInTheDocument();
  });

  it('点击导入按钮打开 Modal 显示操作指引', () => {
    render(<ImportExportPanel type='user' />);
    fireEvent.click(screen.getByRole('button', { name: /导入用户数据/ }));
    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByText(/操作指引/)).toBeInTheDocument();
  });

  it('选择非允许扩展名文件触发 toast 错误', () => {
    const { container } = render(<ImportExportPanel type='user' />);
    fireEvent.click(screen.getByRole('button', { name: /导入用户数据/ }));
    selectFile(container, makeFile('a.txt', ''));
    expect(hoisted.showToast).toHaveBeenCalledWith('error', expect.stringContaining('格式'));
  });

  it('选择超过 50MB 文件触发 toast 错误', () => {
    const { container } = render(<ImportExportPanel type='user' />);
    fireEvent.click(screen.getByRole('button', { name: /导入用户数据/ }));
    const big = new File([new Uint8Array(51 * 1024 * 1024).fill(0)], 'big.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    selectFile(container, big);
    expect(hoisted.showToast).toHaveBeenCalledWith('error', expect.stringContaining('50MB'));
  });

  it('选择有效文件后显示文件名', () => {
    const { container } = render(<ImportExportPanel type='user' />);
    fireEvent.click(screen.getByRole('button', { name: /导入用户数据/ }));
    selectFile(
      container,
      makeFile('data.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    );
    expect(screen.getByText('data.xlsx')).toBeInTheDocument();
  });

  it('移除已选文件后文件名消失', () => {
    const { container } = render(<ImportExportPanel type='user' />);
    fireEvent.click(screen.getByRole('button', { name: /导入用户数据/ }));
    selectFile(
      container,
      makeFile('data.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    );
    expect(screen.getByText('data.xlsx')).toBeInTheDocument();
    const removeBtn = container.querySelector('div.bg-gray-100 button') as HTMLButtonElement;
    fireEvent.click(removeBtn);
    expect(screen.queryByText('data.xlsx')).not.toBeInTheDocument();
  });

  it('onDataImport 成功 → 展示导入结果 + success toast', async () => {
    const onDataImport = vi.fn().mockResolvedValue({
      success: true,
      message: '导入成功',
      total: 3,
      success_count: 3,
    });
    const { container } = render(
      <ImportExportPanel type='user' onDataImport={onDataImport} onImportComplete={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /导入用户数据/ }));
    selectFile(
      container,
      makeFile('data.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    );
    fireEvent.click(screen.getByRole('button', { name: /开始导入/ }));
    await waitFor(() => expect(onDataImport).toHaveBeenCalled());
    expect(hoisted.showToast).toHaveBeenCalledWith('success', expect.stringContaining('导入成功'));
    expect(screen.getByText('导入成功')).toBeInTheDocument();
  });

  it('onDataImport 失败 → error toast + 失败结果区', async () => {
    const onDataImport = vi.fn().mockRejectedValue(new Error('服务器炸了'));
    const { container } = render(<ImportExportPanel type='user' onDataImport={onDataImport} />);
    fireEvent.click(screen.getByRole('button', { name: /导入用户数据/ }));
    selectFile(
      container,
      makeFile('data.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    );
    fireEvent.click(screen.getByRole('button', { name: /开始导入/ }));
    await waitFor(() =>
      expect(hoisted.showToast).toHaveBeenCalledWith('error', expect.stringContaining('服务器炸了'))
    );
  });

  it('onDataImport 部分失败 → warning toast + 失败计数', async () => {
    const onDataImport = vi.fn().mockResolvedValue({
      success: false,
      message: '部分失败',
      total: 2,
      success_count: 1,
      failed_count: 1,
      messages: [
        { action: '失败', message: '行1错误', row_number: 1, error_fields: ['name'] },
        { action: '成功', message: '行2成功' },
      ],
    });
    const { container } = render(<ImportExportPanel type='user' onDataImport={onDataImport} />);
    fireEvent.click(screen.getByRole('button', { name: /导入用户数据/ }));
    selectFile(
      container,
      makeFile('data.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    );
    fireEvent.click(screen.getByRole('button', { name: /开始导入/ }));
    await waitFor(() =>
      expect(hoisted.showToast).toHaveBeenCalledWith(
        'warning',
        expect.stringContaining('成功 1 条')
      )
    );
    expect(screen.getByText('导入详情 (2 条)')).toBeInTheDocument();
  });

  it('onDataExport 成功 → 调用 downloadBlob + success toast', async () => {
    const onDataExport = vi.fn().mockResolvedValue(new Blob(['x']));
    render(<ImportExportPanel type='user' onDataExport={onDataExport} />);
    fireEvent.click(screen.getByRole('button', { name: /导出用户数据 \(Excel\)/ }));
    await waitFor(() => expect(onDataExport).toHaveBeenCalledWith('excel'));
    expect(hoisted.downloadBlob).toHaveBeenCalled();
    expect(hoisted.showToast).toHaveBeenCalledWith('success', '导出成功');
  });

  it('onDataExport 失败 → error toast', async () => {
    const onDataExport = vi.fn().mockRejectedValue(new Error('导出失败'));
    render(<ImportExportPanel type='user' onDataExport={onDataExport} />);
    fireEvent.click(screen.getByRole('button', { name: /导出用户数据 \(Excel\)/ }));
    await waitFor(() =>
      expect(hoisted.showToast).toHaveBeenCalledWith('error', expect.stringContaining('导出失败'))
    );
  });

  it('错误详情可展开/折叠', async () => {
    const onDataImport = vi.fn().mockResolvedValue({
      success: false,
      message: '部分失败',
      failed_count: 1,
      messages: [{ action: '失败', message: '行1错误', error_fields: ['name'] }],
    });
    const { container } = render(<ImportExportPanel type='user' onDataImport={onDataImport} />);
    fireEvent.click(screen.getByRole('button', { name: /导入用户数据/ }));
    selectFile(
      container,
      makeFile('data.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    );
    fireEvent.click(screen.getByRole('button', { name: /开始导入/ }));
    await waitFor(() => expect(screen.getByText(/导入详情/)).toBeInTheDocument());
    // 默认收起，点击展开显示错误字段
    const toggle = screen.getByText(/导入详情/).closest('button')!;
    fireEvent.click(toggle);
    expect(screen.getByText('行1错误')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
  });

  it('准备重新导入 → 显示批量修正区，并可下载失败数据 CSV', async () => {
    const onDataImport = vi.fn().mockResolvedValue({
      success: false,
      message: '部分失败',
      failed_count: 1,
      messages: [
        {
          action: '失败',
          message: '行1错误',
          row_number: 1,
          error_fields: ['name'],
          row_data: { name: '张三', age: '20' },
        },
      ],
    });
    const { container } = render(<ImportExportPanel type='user' onDataImport={onDataImport} />);
    fireEvent.click(screen.getByRole('button', { name: /导入用户数据/ }));
    selectFile(
      container,
      makeFile('data.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    );
    fireEvent.click(screen.getByRole('button', { name: /开始导入/ }));
    await waitFor(() => expect(screen.getByText('准备重新导入')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /准备重新导入/ }));
    expect(screen.getByText(/批量修正重新导入/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /下载失败数据/ }));
    expect(hoisted.downloadTextAsFile).toHaveBeenCalled();
  });

  it('导出错误数据：有 messages → 调 fetch 下载', async () => {
    const onDataImport = vi.fn().mockResolvedValue({
      success: false,
      message: '部分失败',
      failed_count: 1,
      messages: [{ action: '失败', message: '行1错误' }],
    });
    const blob = new Blob(['err']);
    const fetchStub = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob });
    vi.stubGlobal('fetch', fetchStub);
    const { container } = render(<ImportExportPanel type='user' onDataImport={onDataImport} />);
    fireEvent.click(screen.getByRole('button', { name: /导入用户数据/ }));
    selectFile(
      container,
      makeFile('data.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    );
    fireEvent.click(screen.getByRole('button', { name: /开始导入/ }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /导出错误数据/ })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: /导出错误数据/ }));
    await waitFor(() => expect(fetchStub).toHaveBeenCalled());
    expect(hoisted.downloadBlob).toHaveBeenCalled();
  });

  it('showImport/showExport/showTemplate=false 隐藏对应按钮', () => {
    render(
      <ImportExportPanel type='user' showImport={false} showExport={false} showTemplate={false} />
    );
    expect(screen.queryByRole('button', { name: /导入用户数据/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /导出用户数据/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /下载导入模板/ })).not.toBeInTheDocument();
  });

  it('传入 permissions 时使用 PermissionButton 并带 permission', () => {
    render(
      <ImportExportPanel
        type='user'
        permissions={{ import: 'import:user', export: 'export:user', template: 'template:user' }}
      />
    );
    expect(
      screen.getByRole('button', { name: /导入用户数据/ }).getAttribute('data-permission')
    ).toBe('import:user');
  });

  it('重置状态关闭 Modal', () => {
    render(<ImportExportPanel type='user' />);
    fireEvent.click(screen.getByRole('button', { name: /导入用户数据/ }));
    expect(screen.getByTestId('modal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /取消/ }));
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });
});
