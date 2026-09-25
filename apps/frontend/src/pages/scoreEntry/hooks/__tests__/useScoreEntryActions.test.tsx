import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScoreEntryActions } from '../useScoreEntryActions';
import type { ScoreEntryActionsParams } from '../useScoreEntryActions';

const { mockApi, mockConfirm, mockDownloadBlob } = vi.hoisted(() => ({
  mockApi: {
    scores: {
      update: vi.fn(),
      create: vi.fn(),
      importScores: vi.fn(),
      confirmAll: vi.fn(),
      delete: vi.fn(),
    },
    export: { errors: vi.fn() },
  },
  mockConfirm: vi.fn(),
  mockDownloadBlob: vi.fn(),
}));

vi.mock('../../../../services/api', () => ({
  default: mockApi,
  getAuthHeaders: vi.fn(() => ({})),
}));
vi.mock('../../../../components', () => ({ useConfirm: () => mockConfirm }));
vi.mock('../../../../utils/download', () => ({ downloadBlob: mockDownloadBlob }));

function makeParams(overrides: Record<string, unknown> = {}) {
  return {
    showToast: vi.fn(),
    dispatch: vi.fn(),
    selectedExam: '3',
    selectedClass: '5',
    scores: {} as Record<string, unknown>,
    pendingChanges: {} as Record<string, unknown>,
    importFile: null,
    importResult: null,
    batchSubject: '',
    confirmRef: { current: mockConfirm },
    fetchStudentsAndScores: vi.fn(),
    clearDraft: vi.fn(),
    getSubjectId: vi.fn(() => 7),
    runBatched: vi.fn(async (keys: unknown[], fn: (k: unknown) => Promise<void>) => {
      let success = 0;
      const failed: { item: unknown; error: string }[] = [];
      for (const k of keys) {
        try {
          await fn(k);
          success++;
        } catch (e) {
          failed.push({ item: k, error: String(e) });
        }
      }
      return { success, failed };
    }),
    setBatchProgress: vi.fn(),
    setBatchFailures: vi.fn(),
    closeImportModal: vi.fn(),
    openImportResultModal: vi.fn(),
    closeBatchModal: vi.fn(),
    ...overrides,
  } as unknown as ScoreEntryActionsParams;
}

describe('useScoreEntryActions · 成绩录入写操作', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockResolvedValue(true);
    mockApi.scores.update.mockResolvedValue({ data: { id: 1, score: 90 } });
    mockApi.scores.create.mockResolvedValue({ data: { id: 2, score: 90 } });
    mockApi.scores.importScores.mockResolvedValue({
      success_count: 1,
      failed_count: 0,
      errors: [],
    });
    mockApi.scores.confirmAll.mockResolvedValue({});
    mockApi.export.errors.mockResolvedValue({});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function render(overrides: Record<string, unknown> = {}) {
    const params = makeParams(overrides);
    const { result } = renderHook(() => useScoreEntryActions(params));
    return { params, result };
  }

  // ── handleScoreBlur ──
  it('handleScoreBlur：非法科目名字符 → 跳过并提示', async () => {
    const { params, result } = render();
    await act(async () => {
      await result.current.handleScoreBlur(1, '数[学]', '90');
    });
    expect(params.showToast).toHaveBeenCalledWith('error', expect.stringContaining('跳过'));
    expect(mockApi.scores.update).not.toHaveBeenCalled();
    expect(mockApi.scores.create).not.toHaveBeenCalled();
  });

  it('handleScoreBlur：分数越界 → 提示 0-100', async () => {
    const { params, result } = render();
    await act(async () => {
      await result.current.handleScoreBlur(1, '数学', '200');
    });
    expect(params.showToast).toHaveBeenCalledWith('error', '分数需在 0-100');
  });

  it('handleScoreBlur：已有 id → api.scores.update 并写回', async () => {
    const { params, result } = render({
      scores: { '1-数学': { id: 5, subject_id: 2 } },
    });
    await act(async () => {
      await result.current.handleScoreBlur(1, '数学', '90');
    });
    expect(mockApi.scores.update).toHaveBeenCalledWith(5, { score: 90 });
    expect(params.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'UPDATE_SCORE' }));
    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'REMOVE_PENDING_CHANGE', payload: '1-数学' })
    );
  });

  it('handleScoreBlur：无 id → api.scores.create 并写回', async () => {
    const { params, result } = render({ scores: {} });
    await act(async () => {
      await result.current.handleScoreBlur(1, '数学', '90');
    });
    expect(mockApi.scores.create).toHaveBeenCalled();
    expect(params.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'UPDATE_SCORE' }));
  });

  it('handleScoreBlur：接口抛错 → 捕获并提示', async () => {
    mockApi.scores.update.mockRejectedValue(new Error('server 500'));
    const { params, result } = render({ scores: { '1-数学': { id: 5 } } });
    await act(async () => {
      await result.current.handleScoreBlur(1, '数学', '90');
    });
    expect(params.showToast).toHaveBeenCalledWith('error', expect.stringContaining('保存失败'));
  });

  // ── focusCell ──
  it('focusCell：定位到对应 input 并 focus（无匹配时不抛）', () => {
    const input = document.createElement('input');
    input.setAttribute('data-sid', '1');
    input.setAttribute('data-subject', '数学');
    document.body.appendChild(input);
    const focusSpy = vi.spyOn(input, 'focus');
    const { result } = render();
    act(() => result.current.focusCell(1, '数学'));
    expect(focusSpy).toHaveBeenCalled();
    document.body.removeChild(input);
  });

  // ── handleSaveAll ──
  it('handleSaveAll：无待保存项 → 提示并返回', async () => {
    const { params, result } = render({ pendingChanges: {} });
    await act(async () => {
      await result.current.handleSaveAll();
    });
    expect(params.showToast).toHaveBeenCalledWith('info', '没有待保存的更改');
  });

  it('handleSaveAll：正常批量保存 → 清空草稿并刷新', async () => {
    const { params, result } = render({
      pendingChanges: { '1-数学': { student_id: 1, subject: '数学', subject_id: 2, score: 90 } },
    });
    await act(async () => {
      await result.current.handleSaveAll();
    });
    expect(params.clearDraft).toHaveBeenCalled();
    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CLEAR_PENDING_CHANGES' })
    );
    expect(params.showToast).toHaveBeenCalledWith('success', expect.stringContaining('已保存'));
  });

  it('handleSaveAll：非法科目名被跳过且失败项保留', async () => {
    const { params, result } = render({
      pendingChanges: {
        '1-数[学]': { student_id: 1, subject: '数[学]', subject_id: 2, score: 90 },
      },
    });
    await act(async () => {
      await result.current.handleSaveAll();
    });
    expect(params.setBatchFailures).toHaveBeenCalled();
    expect(params.showToast).toHaveBeenCalledWith('error', expect.stringContaining('失败'));
  });

  it('handleSaveAll：批量执行部分失败 → 失败分支提示', async () => {
    const { params, result } = render({
      pendingChanges: { '1-数学': { student_id: 1, subject: '数学', subject_id: 2, score: 90 } },
      runBatched: vi.fn(async () => ({ success: 0, failed: [{ item: '1-数学', error: 'boom' }] })),
    });
    await act(async () => {
      await result.current.handleSaveAll();
    });
    expect(params.setBatchFailures).toHaveBeenCalled();
    expect(params.showToast).toHaveBeenCalledWith('error', expect.stringContaining('失败'));
  });

  // ── handleExport ──
  it('handleExport：未选考试 → 抛错', async () => {
    const { result } = render({ selectedExam: '' });
    await expect(result.current.handleExport('csv')).rejects.toThrow('请先选择考试');
  });

  it('handleExport：已选考试且接口 ok → 返回 blob', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['x'])) })
    );
    const { result } = render({ selectedExam: '3' });
    const blob = await act(async () => result.current.handleExport('excel'));
    expect(blob).toBeInstanceOf(Blob);
  });

  // ── handleImport ──
  it('handleImport：无文件 → 直接返回', async () => {
    const { result } = render({ importFile: null });
    await act(async () => {
      await result.current.handleImport();
    });
    expect(mockApi.scores.importScores).not.toHaveBeenCalled();
  });

  it('handleImport：有文件 → 调 importScores 并写回结果', async () => {
    const file = new File([''], 'x.csv');
    const { params, result } = render({ importFile: file, selectedExam: '3' });
    await act(async () => {
      await result.current.handleImport();
    });
    expect(mockApi.scores.importScores).toHaveBeenCalled();
    expect(params.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_IMPORT_RESULT' })
    );
    expect(params.closeImportModal).toHaveBeenCalled();
    expect(params.openImportResultModal).toHaveBeenCalled();
  });

  it('handleImport：接口抛错 → 捕获并提示', async () => {
    mockApi.scores.importScores.mockRejectedValue(new Error('import failed'));
    const { params, result } = render({ importFile: new File([''], 'x.csv'), selectedExam: '3' });
    await act(async () => {
      await result.current.handleImport();
    });
    expect(params.showToast).toHaveBeenCalledWith('error', expect.stringContaining('导入失败'));
  });

  // ── handleExportErrors ──
  it('handleExportErrors：无 errors → 不调用 export.errors', () => {
    const { result } = render({ importResult: null });
    act(() => result.current.handleExportErrors());
    expect(mockApi.export.errors).not.toHaveBeenCalled();
  });

  it('handleExportErrors：有 errors → 调用 export.errors', () => {
    const { result } = render({
      importResult: { errors: [{ row: 1, error_fields: ['a'], message: 'x' }] },
    });
    act(() => result.current.handleExportErrors());
    expect(mockApi.export.errors).toHaveBeenCalled();
  });

  // ── handleConfirmAll ──
  it('handleConfirmAll：confirm 取消 → 不调用', async () => {
    mockConfirm.mockResolvedValueOnce(false);
    const { result } = render({ selectedExam: '3' });
    await act(async () => {
      await result.current.handleConfirmAll();
    });
    expect(mockApi.scores.confirmAll).not.toHaveBeenCalled();
  });

  it('handleConfirmAll：confirm 通过 → 调用 confirmAll', async () => {
    const { params, result } = render({ selectedExam: '3' });
    await act(async () => {
      await result.current.handleConfirmAll();
    });
    expect(mockApi.scores.confirmAll).toHaveBeenCalledWith('3');
    expect(params.clearDraft).toHaveBeenCalled();
  });

  // ── handleBatchDelete / Reset / Confirm ──
  it('handleBatchDelete：未选科目 → 提示', async () => {
    const { params, result } = render({ batchSubject: '' });
    await act(async () => {
      await result.current.handleBatchDelete();
    });
    expect(params.showToast).toHaveBeenCalledWith('error', '请选择要操作的科目');
  });

  it('handleBatchDelete：已选科目 → 批量删除命中 id 的记录', async () => {
    const { params, result } = render({
      batchSubject: '数学',
      scores: { '1-数学': { id: 9 }, '1-语文': { id: 3 } },
    });
    await act(async () => {
      await result.current.handleBatchDelete();
    });
    expect(mockApi.scores.delete).toHaveBeenCalledWith(9);
    expect(mockApi.scores.delete).not.toHaveBeenCalledWith(3);
    expect(params.closeBatchModal).toHaveBeenCalled();
    expect(params.showToast).toHaveBeenCalledWith('success', expect.stringContaining('已删除'));
  });

  it('handleBatchReset：批量重置 → 调 delete', async () => {
    const { result } = render({
      batchSubject: '数学',
      scores: { '1-数学': { id: 9 } },
    });
    await act(async () => {
      await result.current.handleBatchReset();
    });
    expect(mockApi.scores.delete).toHaveBeenCalledWith(9);
  });

  it('handleBatchConfirm：批量确认 → 调 update 写回分数', async () => {
    const { result } = render({
      batchSubject: '数学',
      scores: { '1-数学': { id: 9, score: 88 } },
    });
    await act(async () => {
      await result.current.handleBatchConfirm();
    });
    expect(mockApi.scores.update).toHaveBeenCalledWith(9, { score: 88 });
  });

  // ── handlePrint / exportTemplate ──
  it('handlePrint：调用 window.print', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const { result } = render();
    act(() => result.current.handlePrint());
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it('exportTemplate：接口 ok → 触发下载', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['x'])) })
    );
    const { result } = render({ selectedClass: '5', selectedExam: '3' });
    await act(async () => {
      await result.current.exportTemplate();
    });
    expect(mockDownloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.stringContaining('score_import_template_5.xlsx')
    );
  });

  it('exportTemplate：接口失败 → 提示', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const { params, result } = render({ selectedClass: '5', selectedExam: '3' });
    await act(async () => {
      await result.current.exportTemplate();
    });
    expect(params.showToast).toHaveBeenCalledWith('error', expect.stringContaining('下载模板失败'));
  });
});
