import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ScoreEntryView from './ScoreEntryView';
import type { ScoreEntryViewProps } from './types';

// ── react-router-dom：仅覆盖 useNavigate，保留 MemoryRouter 真实实现 ──
const { navigateFn } = vi.hoisted(() => ({ navigateFn: vi.fn() }));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: vi.fn(() => navigateFn) };
});

// ── formatDateTime：纯函数直接桩为固定串，保证断言稳定 ──
vi.mock('../../utils/format', () => ({
  formatDateTime: vi.fn(() => '2026-01-01'),
}));

// ── 重型子组件统一桩替身（纯渲染，转发 onClick / disabled） ──
vi.mock('../../components', () => {
  const Card = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Button = ({
    children,
    onClick,
    disabled,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
  const Modal = ({ isOpen, children }: { isOpen: boolean; children?: React.ReactNode }) =>
    isOpen ? <div role='dialog'>{children}</div> : null;
  const PermissionButton = ({
    children,
    onClick,
    disabled,
    title,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    title?: string;
  }) => (
    <button title={title} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
  const DataTable = () => <div data-testid='datatable' />;
  const ImportExportPanel = () => <div data-testid='import-export-panel' />;
  return { Card, Button, Modal, PermissionButton, DataTable, ImportExportPanel };
});

// ── 最小 User / 类型安全桩 ──
const mkUser = (id: number) =>
  ({ id } as unknown as ScoreEntryViewProps['filteredStudents'][number]);

function makeProps(overrides: Partial<ScoreEntryViewProps> = {}): ScoreEntryViewProps {
  const state = {
    exams: [{ id: 1, name: '期中考', start_time: '2026-01-01' }],
    selectedExam: '1',
    classes: [{ id: 1, name: '一班' }],
    selectedClass: '',
    students: [mkUser(1)],
    subjects: [],
    scores: {},
    loading: false,
    importFile: null,
    editingCell: null,
    filterSubject: '',
    statusFilter: '',
    batchSubject: '',
    importResult: null,
    pendingChanges: {},
  };
  const base: ScoreEntryViewProps = {
    state,
    dispatch: vi.fn(),
    setClassInput: vi.fn(),
    columns: [] as unknown as ScoreEntryViewProps['columns'],
    examSubjects: ['数学', '语文'],
    visibleSubjects: ['数学'],
    getEntryProgress: 100,
    filteredStudents: [] as unknown as ScoreEntryViewProps['filteredStudents'],
    handleSaveAll: vi.fn(),
    handleExport: vi.fn(),
    handleImport: vi.fn(),
    handleExportErrors: vi.fn(),
    handleConfirmAll: vi.fn(),
    handleBatchDelete: vi.fn(),
    handleBatchReset: vi.fn(),
    handleBatchConfirm: vi.fn(),
    handlePrint: vi.fn(),
    exportTemplate: vi.fn(),
    handleRestoreDraft: vi.fn(),
    handleDiscardDraft: vi.fn(),
    onRefresh: vi.fn(),
    onCancelBatch: vi.fn(),
    runSubmit: vi.fn(),
    submitting: false,
    draftAvailable: false,
    batchProgress: null,
    batchFailures: null,
    setBatchFailures: vi.fn(),
    showImportModal: false,
    openImportModal: vi.fn(),
    closeImportModal: vi.fn(),
    showBatchModal: false,
    openBatchModal: vi.fn(),
    closeBatchModal: vi.fn(),
    showImportResultModal: false,
    closeImportResultModal: vi.fn(),
  };
  return { ...base, ...overrides } as ScoreEntryViewProps;
}

function renderView(props: ScoreEntryViewProps) {
  return render(
    <MemoryRouter>
      <ScoreEntryView {...props} />
    </MemoryRouter>
  );
}

// 组件用 <label>文本</label> + 独立 <select>/<input> 但无 htmlFor/id 关联，
// RTL 的 getByLabelText 无法定位，改为按标签文本找相邻控件。
function controlByLabel(text: string): HTMLElement {
  const label = screen.getByText(text);
  const control = label.nextElementSibling as HTMLElement | null;
  if (!control) throw new Error(`No control after label "${text}"`);
  return control;
}

describe('ScoreEntryView 渲染与分支覆盖 B49', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染标题、考试下拉选项与考试时间', () => {
    renderView(makeProps());
    expect(screen.getByText('成绩录入')).toBeInTheDocument();
    expect(screen.getByText('期中考')).toBeInTheDocument();
    expect(screen.getByText('一班')).toBeInTheDocument();
    expect(screen.getByText('考试时间: 2026-01-01')).toBeInTheDocument();
  });

  it('draftAvailable=true 渲染恢复条，点击恢复/放弃触发回调', () => {
    const props = makeProps({ draftAvailable: true });
    renderView(props);
    const restore = screen.getByText('恢复');
    const discard = screen.getByText('放弃');
    fireEvent.click(restore);
    fireEvent.click(discard);
    expect(props.handleRestoreDraft).toHaveBeenCalledTimes(1);
    expect(props.handleDiscardDraft).toHaveBeenCalledTimes(1);
  });

  it('未选考试时不渲染考试时间（selectedExamData 守卫）', () => {
    const props = makeProps({
      state: { ...makeProps().state, selectedExam: '', exams: [] },
    });
    renderView(props);
    expect(screen.queryByText(/考试时间:/)).toBeNull();
  });

  it('进度 100% 显示查看分析，点击导航到分析页', () => {
    renderView(makeProps());
    const btn = screen.getByRole('button', { name: /查看分析/ });
    fireEvent.click(btn);
    expect(navigateFn).toHaveBeenCalledWith('/score-analysis?exam_id=1');
  });

  it('进度非 100% 不显示查看分析', () => {
    renderView(makeProps({ getEntryProgress: 50 }));
    expect(screen.queryByRole('button', { name: /查看分析/ })).toBeNull();
  });

  it('pendingChanges 非空：显示待保存计数且保存全部可用', () => {
    const props = makeProps({
      state: {
        ...makeProps().state,
        pendingChanges: { '1-数学': { student_id: 1, subject: '数学', score: 90 } },
      },
    });
    renderView(props);
    expect(screen.getByText(/\d+ 条待保存/)).toBeInTheDocument();
    const saveBtn = screen.getByRole('button', { name: /保存全部/ });
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);
    expect(props.runSubmit).toHaveBeenCalledWith(props.handleSaveAll);
  });

  it('pendingChanges 为空：保存全部禁用并显示 title 提示', () => {
    renderView(makeProps());
    const saveBtn = screen.getByRole('button', { name: /保存全部/ }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
    expect(saveBtn.title).toContain('自动保存');
  });

  it('students 为空时确认全部禁用；有学生时可用', () => {
    const empty = makeProps({ state: { ...makeProps().state, students: [] as never } });
    const { unmount } = renderView(empty);
    const disabledBtn = screen.getByRole('button', { name: /确认全部/ }) as HTMLButtonElement;
    expect(disabledBtn.disabled).toBe(true);
    unmount();

    const ok = makeProps();
    renderView(ok);
    const enabledBtn = screen.getByRole('button', { name: /确认全部/ }) as HTMLButtonElement;
    expect(enabledBtn.disabled).toBe(false);
    fireEvent.click(enabledBtn);
    expect(ok.handleConfirmAll).toHaveBeenCalledTimes(1);
  });

  it('点击标题区权限按钮触发各自 handler', () => {
    const props = makeProps();
    renderView(props);
    fireEvent.click(screen.getByText('下载模板'));
    fireEvent.click(screen.getByText('批量操作'));
    fireEvent.click(screen.getByText('打印'));
    fireEvent.click(screen.getByText('导入'));
    fireEvent.click(screen.getByText('刷新'));
    expect(props.exportTemplate).toHaveBeenCalledTimes(1);
    expect(props.openBatchModal).toHaveBeenCalledTimes(1);
    expect(props.handlePrint).toHaveBeenCalledTimes(1);
    expect(props.openImportModal).toHaveBeenCalledTimes(1);
    expect(props.onRefresh).toHaveBeenCalledTimes(1);
  });

  it('batchProgress 存在：渲染进度条与取消按钮', () => {
    const props = makeProps({ batchProgress: { processed: 3, total: 10 } });
    renderView(props);
    expect(screen.getByText(/正在保存 3\/10 条/)).toBeInTheDocument();
    expect(screen.getByText(/预计剩余 6 秒/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('取消'));
    expect(props.onCancelBatch).toHaveBeenCalledTimes(1);
  });

  it('batchFailures 存在：渲染失败列表与关闭', () => {
    const props = makeProps({ batchFailures: [{ key: 'k1', error: 'boom' }] });
    renderView(props);
    expect(screen.getByText(/1 条保存失败/)).toBeInTheDocument();
    expect(screen.getByText('[k1] boom')).toBeInTheDocument();
    fireEvent.click(screen.getByText('关闭'));
    expect(props.setBatchFailures).toHaveBeenCalledWith(null);
  });

  it('导入 Modal：选择文件派发 SET_IMPORT_FILE；导入按钮按 importFile 可用', () => {
    const file = new File(['x'], 'a.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const props = makeProps({
      showImportModal: true,
      state: { ...makeProps().state, importFile: file },
    });
    renderView(props);
    const dialog = screen.getByRole('dialog');
    const input = controlByLabel('选择 Excel 文件') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(props.dispatch).toHaveBeenCalledWith({ type: 'SET_IMPORT_FILE', payload: file });
    const importBtn = within(dialog).getByRole('button', { name: '导入' }) as HTMLButtonElement;
    expect(importBtn.disabled).toBe(false);
    fireEvent.click(importBtn);
    expect(props.runSubmit).toHaveBeenCalledWith(props.handleImport);
  });

  it('导入 Modal 无文件时导入按钮禁用', () => {
    const props = makeProps({ showImportModal: true });
    renderView(props);
    const dialog = screen.getByRole('dialog');
    const importBtn = within(dialog).getByRole('button', { name: '导入' }) as HTMLButtonElement;
    expect(importBtn.disabled).toBe(true);
    fireEvent.click(within(dialog).getByText('取消'));
    expect(props.closeImportModal).toHaveBeenCalledTimes(1);
  });

  it('批量操作 Modal：科目选择派发；三按钮按 batchSubject 可用性触发', () => {
    const props = makeProps({
      showBatchModal: true,
      state: { ...makeProps().state, batchSubject: '数学' },
    });
    renderView(props);
    const select = controlByLabel('选择科目') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '语文' } });
    expect(props.dispatch).toHaveBeenCalledWith({ type: 'SET_BATCH_SUBJECT', payload: '语文' });

    const confirm = screen.getByRole('button', { name: '批量确认' }) as HTMLButtonElement;
    const reset = screen.getByRole('button', { name: '批量重置' }) as HTMLButtonElement;
    const del = screen.getByRole('button', { name: '批量删除' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
    expect(reset.disabled).toBe(false);
    expect(del.disabled).toBe(false);
    fireEvent.click(confirm);
    fireEvent.click(reset);
    fireEvent.click(del);
    expect(props.runSubmit).toHaveBeenCalledWith(props.handleBatchConfirm);
    expect(props.runSubmit).toHaveBeenCalledWith(props.handleBatchReset);
    expect(props.runSubmit).toHaveBeenCalledWith(props.handleBatchDelete);
    fireEvent.click(screen.getByText('关闭'));
    expect(props.closeBatchModal).toHaveBeenCalledTimes(1);
  });

  it('批量操作 Modal：batchSubject 为空时三按钮禁用', () => {
    const props = makeProps({ showBatchModal: true });
    renderView(props);
    expect((screen.getByRole('button', { name: '批量确认' }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect((screen.getByRole('button', { name: '批量重置' }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect((screen.getByRole('button', { name: '批量删除' }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it('导入结果 Modal：成功/失败计数、失败详情与导出错误数据', () => {
    const props = makeProps({
      showImportResultModal: true,
      state: {
        ...makeProps().state,
        importResult: {
          successCount: 5,
          failedCount: 2,
          failedMessages: ['err1', 'err2'],
          errors: [{ error_fields: ['a'], message: 'm' }],
        },
      },
    });
    renderView(props);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('err1')).toBeInTheDocument();
    expect(screen.getByText('err2')).toBeInTheDocument();
    fireEvent.click(screen.getByText('导出错误数据'));
    expect(props.handleExportErrors).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('关闭'));
    expect(props.closeImportResultModal).toHaveBeenCalledTimes(1);
  });

  it('导入结果 Modal：无 errors 时不显示导出错误数据按钮', () => {
    const props = makeProps({
      showImportResultModal: true,
      state: {
        ...makeProps().state,
        importResult: { successCount: 1, failedCount: 0, failedMessages: [] },
      },
    });
    renderView(props);
    expect(screen.queryByText('导出错误数据')).toBeNull();
  });

  it('各筛选 select 变更派发对应 action', () => {
    const props = makeProps();
    renderView(props);
    fireEvent.change(controlByLabel('选择考试 *'), { target: { value: '1' } });
    fireEvent.change(controlByLabel('筛选班级'), { target: { value: '1' } });
    fireEvent.change(controlByLabel('筛选科目'), { target: { value: '语文' } });
    fireEvent.change(controlByLabel('状态筛选'), { target: { value: 'pending' } });
    expect(props.dispatch).toHaveBeenCalledWith({ type: 'SET_SELECTED_EXAM', payload: '1' });
    expect(props.setClassInput).toHaveBeenCalledWith('1');
    expect(props.dispatch).toHaveBeenCalledWith({ type: 'SET_FILTER_SUBJECT', payload: '语文' });
    expect(props.dispatch).toHaveBeenCalledWith({ type: 'SET_STATUS_FILTER', payload: 'pending' });
  });
});
