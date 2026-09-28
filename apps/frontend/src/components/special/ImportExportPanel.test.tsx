/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ImportExportPanel from './ImportExportPanel';
import { downloadBlob, downloadTextAsFile } from '../../utils/download';

vi.mock('../../services/api', () => ({
  getAuthHeaders: vi.fn(() => ({})),
}));

vi.mock('../../utils/download', () => ({
  downloadBlob: vi.fn(),
  downloadTextAsFile: vi.fn(),
}));

var mockShowToast: any;
vi.mock('../../context/ToastContext', () => {
  mockShowToast = vi.fn();
  return { useToast: () => ({ showToast: mockShowToast }) };
});

vi.mock('../PermissionGuard', () => ({
  PermissionButton: ({ onClick, children, ...rest }: any) => (
    <button onClick={onClick} {...rest}>
      {children}
    </button>
  ),
}));

const showToast = mockShowToast;

const makeResp = (opts: any = {}) => ({
  ok: opts.ok ?? true,
  status: opts.status ?? 200,
  json: async () => opts.json ?? {},
  blob: async () => opts.blob ?? new Blob(['x']),
  text: async () => opts.text ?? '',
  headers: { get: (k: string) => opts.headers?.[k] ?? null },
});

let mockFetch: any;

const fileWith = (name: string, type = '', extra: any = {}) => {
  const f = new File(['x'], name, type ? { type } : undefined) as any;
  if (extra.size !== undefined) {
    Object.defineProperty(f, 'size', { value: extra.size, configurable: true });
  }
  return f;
};

const openImportModal = (c: HTMLElement) => {
  fireEvent.click(screen.getByText(/导入.*数据/));
  return c.querySelector('input[type="file"]') as HTMLInputElement;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch = vi.fn();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ImportExportPanel', () => {
  describe('handleFileChange', () => {
    it('无效扩展名 → 错误 toast', () => {
      const c = render(<ImportExportPanel type='user' />).container;
      const input = openImportModal(c);
      fireEvent.change(input, { target: { files: [fileWith('bad.txt')] } });
      expect(showToast).toHaveBeenCalledWith('error', expect.stringContaining('仅支持'));
    });

    it('合法 .xlsx 扩展名 → setImportFile（显示文件名）', () => {
      const c = render(<ImportExportPanel type='user' />).container;
      const input = openImportModal(c);
      fireEvent.change(input, {
        target: {
          files: [
            fileWith(
              'good.xlsx',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ),
          ],
        },
      });
      expect(screen.getByText('good.xlsx')).toBeTruthy();
    });

    it('Excel mimetype (.xls) → 通过', () => {
      const c = render(<ImportExportPanel type='user' />).container;
      const input = openImportModal(c);
      fireEvent.change(input, {
        target: { files: [fileWith('good.xls', 'application/vnd.ms-excel')] },
      });
      expect(screen.getByText('good.xls')).toBeTruthy();
    });

    it('JSON 扩展名（acceptFormats 含 .json）→ 通过', () => {
      const c = render(<ImportExportPanel type='user' acceptFormats='.json' />).container;
      const input = openImportModal(c);
      fireEvent.change(input, { target: { files: [fileWith('a.json', 'application/json')] } });
      expect(screen.getByText('a.json')).toBeTruthy();
    });

    it('超过 50MB → 错误 toast', () => {
      const c = render(<ImportExportPanel type='user' />).container;
      const input = openImportModal(c);
      const big = fileWith(
        'big.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        {
          size: 60 * 1024 * 1024,
        }
      );
      fireEvent.change(input, { target: { files: [big] } });
      expect(showToast).toHaveBeenCalledWith('error', '文件大小不能超过 50MB');
    });
  });

  describe('handleImport（onDataImport 路径）', () => {
    it('成功（含 failed_count）→ success toast + onImportComplete', async () => {
      const onImportComplete = vi.fn();
      const onDataImport = vi.fn(async () => ({
        success: true,
        message: 'ok',
        success_count: 2,
        failed_count: 1,
        total: 3,
      }));
      const c = render(
        <ImportExportPanel
          type='user'
          onDataImport={onDataImport}
          onImportComplete={onImportComplete}
        />
      ).container;
      const input = openImportModal(c);
      fireEvent.change(input, {
        target: {
          files: [
            fileWith(
              'good.xlsx',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ),
          ],
        },
      });
      fireEvent.click(screen.getByText('开始导入'));
      await waitFor(() => expect(onDataImport).toHaveBeenCalled());
      expect(showToast).toHaveBeenCalledWith('success', 'ok');
      expect(onImportComplete).toHaveBeenCalled();
    });

    it('失败（无 failed_count）→ error toast', async () => {
      const onDataImport = vi.fn(async () => ({ success: false, message: 'boom' }));
      const c = render(<ImportExportPanel type='user' onDataImport={onDataImport} />).container;
      const input = openImportModal(c);
      fireEvent.change(input, {
        target: {
          files: [
            fileWith(
              'good.xlsx',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ),
          ],
        },
      });
      fireEvent.click(screen.getByText('开始导入'));
      await waitFor(() => expect(onDataImport).toHaveBeenCalled());
      expect(showToast).toHaveBeenCalledWith('error', 'boom');
    });

    it('异常 → catch error toast', async () => {
      const onDataImport = vi.fn(async () => {
        throw new Error('net fail');
      });
      const c = render(<ImportExportPanel type='user' onDataImport={onDataImport} />).container;
      const input = openImportModal(c);
      fireEvent.change(input, {
        target: {
          files: [
            fileWith(
              'good.xlsx',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ),
          ],
        },
      });
      fireEvent.click(screen.getByText('开始导入'));
      await waitFor(() => expect(onDataImport).toHaveBeenCalled());
      expect(showToast).toHaveBeenCalledWith('error', '导入失败: net fail');
    });
  });

  describe('handleImport（fetch 路径）', () => {
    it('成功 → success toast', async () => {
      mockFetch.mockResolvedValue(
        makeResp({ json: { success: true, message: 'ok', success_count: 1, total: 1 } })
      );
      const c = render(<ImportExportPanel type='user' importUrl='/api/x' />).container;
      const input = openImportModal(c);
      fireEvent.change(input, {
        target: {
          files: [
            fileWith(
              'good.xlsx',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ),
          ],
        },
      });
      fireEvent.click(screen.getByText('开始导入'));
      await waitFor(() => expect(mockFetch).toHaveBeenCalled());
      expect(showToast).toHaveBeenCalledWith('success', 'ok');
    });
  });

  describe('handleExport（onDataExport 路径）', () => {
    it('成功 → downloadBlob + success toast', async () => {
      const onDataExport = vi.fn(async () => new Blob(['x']));
      render(<ImportExportPanel type='user' onDataExport={onDataExport} />);
      fireEvent.click(screen.getByText('导出用户数据 (Excel)'));
      await waitFor(() => expect(onDataExport).toHaveBeenCalled());
      expect(downloadBlob).toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith('success', '导出成功');
    });

    it('异常 → error toast', async () => {
      const onDataExport = vi.fn(async () => {
        throw new Error('exp fail');
      });
      render(<ImportExportPanel type='user' onDataExport={onDataExport} />);
      fireEvent.click(screen.getByText('导出用户数据 (Excel)'));
      await waitFor(() => expect(onDataExport).toHaveBeenCalled());
      expect(showToast).toHaveBeenCalledWith('error', '导出失败: exp fail');
    });
  });

  describe('handleExport（fetch 路径 + Content-Disposition）', () => {
    it('UTF-8 filename 解析', async () => {
      mockFetch.mockResolvedValue(
        makeResp({
          headers: { 'Content-Disposition': "attachment; filename*=UTF-8''%E6%B5%8B.xlsx" },
        })
      );
      render(<ImportExportPanel type='user' exportUrl='/api/e' />);
      fireEvent.click(screen.getByText('导出用户数据 (Excel)'));
      await waitFor(() => expect(mockFetch).toHaveBeenCalled());
      expect(downloadBlob).toHaveBeenCalled();
    });

    it('ASCII filename 解析', async () => {
      mockFetch.mockResolvedValue(
        makeResp({ headers: { 'Content-Disposition': 'attachment; filename="plain.csv"' } })
      );
      render(<ImportExportPanel type='user' exportUrl='/api/e' />);
      fireEvent.click(screen.getByText('导出用户数据 (Excel)'));
      await waitFor(() => expect(mockFetch).toHaveBeenCalled());
      expect(downloadBlob).toHaveBeenCalled();
    });

    it('响应非 ok → throw + error toast', async () => {
      mockFetch.mockResolvedValue(makeResp({ ok: false, status: 500, text: 'server err' }));
      render(<ImportExportPanel type='user' exportUrl='/api/e' />);
      fireEvent.click(screen.getByText('导出用户数据 (Excel)'));
      await waitFor(() => expect(mockFetch).toHaveBeenCalled());
      expect(showToast).toHaveBeenCalledWith('error', expect.stringContaining('导出失败'));
    });
  });

  describe('handleDownloadTemplate', () => {
    it('成功 → downloadBlob + success toast', async () => {
      mockFetch.mockResolvedValue(makeResp({ blob: new Blob(['t']) }));
      render(<ImportExportPanel type='user' templateUrl='/api/t' />);
      fireEvent.click(screen.getByText('下载导入模板'));
      await waitFor(() => expect(mockFetch).toHaveBeenCalled());
      expect(downloadBlob).toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith('success', '模板下载成功');
    });

    it('响应非 ok → throw + error toast', async () => {
      mockFetch.mockResolvedValue(makeResp({ ok: false, status: 500 }));
      render(<ImportExportPanel type='user' templateUrl='/api/t' />);
      fireEvent.click(screen.getByText('下载导入模板'));
      await waitFor(() => expect(mockFetch).toHaveBeenCalled());
      expect(showToast).toHaveBeenCalledWith('error', expect.stringContaining('下载模板失败'));
    });
  });

  describe('导入结果面板 + 错误信息导出', () => {
    const failedImport = {
      success: false,
      message: 'partial',
      failed_count: 1,
      messages: [{ action: '失败', message: 'row bad', row_number: 1, error_fields: ['name'] }],
    };

    it('导入失败后展示错误详情 + 导出错误数据', async () => {
      const onDataImport = vi.fn(async () => failedImport);
      const c = render(<ImportExportPanel type='user' onDataImport={onDataImport} />).container;
      const input = openImportModal(c);
      fireEvent.change(input, {
        target: {
          files: [
            fileWith(
              'good.xlsx',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ),
          ],
        },
      });
      fireEvent.click(screen.getByText('开始导入'));
      await waitFor(() => expect(onDataImport).toHaveBeenCalled());
      fireEvent.click(screen.getByText(/导入详情/));
      expect(screen.getByText('row bad')).toBeTruthy();
      mockFetch.mockResolvedValue(makeResp({ blob: new Blob(['x']) }));
      fireEvent.click(screen.getByText('导出错误数据'));
      await waitFor(() => expect(mockFetch).toHaveBeenCalled());
      expect(showToast).toHaveBeenCalledWith('success', '错误数据导出成功');
    });

    it('准备重新导入 → 展示失败数据面板 + 下载失败数据', async () => {
      const onDataImport = vi.fn(async () => failedImport);
      const c = render(<ImportExportPanel type='user' onDataImport={onDataImport} />).container;
      const input = openImportModal(c);
      fireEvent.change(input, {
        target: {
          files: [
            fileWith(
              'good.xlsx',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ),
          ],
        },
      });
      fireEvent.click(screen.getByText('开始导入'));
      await waitFor(() => expect(onDataImport).toHaveBeenCalled());
      fireEvent.click(screen.getByText('准备重新导入'));
      expect(screen.getByText(/批量修正重新导入/)).toBeTruthy();
      fireEvent.click(screen.getByText('下载失败数据'));
      expect(downloadTextAsFile).toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith('success', expect.stringContaining('已导出'));
    });
  });

  describe('渲染分支 / 开关', () => {
    it('showImport/showExport/showTemplate 全关 → 不渲染按钮', () => {
      render(
        <ImportExportPanel type='user' showImport={false} showExport={false} showTemplate={false} />
      );
      expect(screen.queryByText(/导入.*数据/)).toBeNull();
      expect(screen.queryByText('下载导入模板')).toBeNull();
    });

    it('permissions 存在 → PermissionButton 分支', () => {
      render(
        <ImportExportPanel
          type='user'
          permissions={{ import: 'imp', export: 'exp', template: 'tmp' }}
        />
      );
      expect(screen.getByText(/导入.*数据/)).toBeTruthy();
    });

    it('移除已选文件 → 文件名消失', () => {
      const c = render(<ImportExportPanel type='user' />).container;
      const input = openImportModal(c);
      fireEvent.change(input, {
        target: {
          files: [
            fileWith(
              'good.xlsx',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ),
          ],
        },
      });
      expect(screen.getByText('good.xlsx')).toBeTruthy();
      // 移除按钮为 X 图标无文字，用选择器定位
      const removeBtn = c.querySelector('button[class*="text-gray-400"]') as HTMLButtonElement;
      act(() => {
        fireEvent.click(removeBtn);
      });
      expect(screen.queryByText('good.xlsx')).toBeNull();
    });
  });
});
