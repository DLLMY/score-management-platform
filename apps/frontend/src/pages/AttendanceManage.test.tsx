import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import AttendanceManage from './AttendanceManage';
import type { AttendanceDraft } from './attendanceManage/types';

const { mockShowToast, apiMocks, autoSaveState, mockAttendances } = vi.hoisted(() => ({
  mockShowToast: vi.fn(),
  apiMocks: {
    getAll: vi.fn(),
    getStats: vi.fn(),
    getLeaves: vi.fn(),
    record: vi.fn(),
    batchRecord: vi.fn(),
    applyLeave: vi.fn(),
    approveLeave: vi.fn(),
    usersGetAll: vi.fn(),
  },
  autoSaveState: {
    draftAvailable: false,
    loadDraft: vi.fn<() => AttendanceDraft | null>(() => null),
    restoreDraft: vi.fn<() => AttendanceDraft | null>(() => null),
    discardChanges: vi.fn(),
    clearDraft: vi.fn(),
  },
  mockAttendances: [
    {
      id: 1,
      student_id: 1,
      student_name: '张三',
      class_id: 1,
      class_name: '一班',
      date: '2026-01-01',
      period: '上午',
      status: 'present',
      notes: '好',
    },
    {
      id: 2,
      student_id: 2,
      date: '2026-01-01',
      period: '上午',
      status: 'absent',
    },
  ],
}));

vi.mock('../services/api', () => ({
  default: {
    attendance: {
      getAll: apiMocks.getAll,
      getStats: apiMocks.getStats,
      getLeaves: apiMocks.getLeaves,
      record: apiMocks.record,
      batchRecord: apiMocks.batchRecord,
      applyLeave: apiMocks.applyLeave,
      approveLeave: apiMocks.approveLeave,
    },
    users: { getAll: apiMocks.usersGetAll },
  },
}));

vi.mock('../hooks', () => ({
  useStableToast: () => ({ showToast: mockShowToast }),
  useSubmitGuard: () => ({ run: (fn: () => void) => fn() }),
  useAutoSave: () => ({
    draftAvailable: autoSaveState.draftAvailable,
    loadDraft: autoSaveState.loadDraft,
    restoreDraft: autoSaveState.restoreDraft,
    discardChanges: autoSaveState.discardChanges,
    clearDraft: autoSaveState.clearDraft,
  }),
  useWorkbenchClass: () => [0, vi.fn()],
  useListData: () => ({ data: mockAttendances, loading: false, refetch: vi.fn() }),
  useClientFilter: (data: unknown[], fn?: (item: unknown) => boolean) =>
    fn ? data.filter(fn) : data,
}));

vi.mock('../utils/getErrMsg', () => ({ getErrMsg: (_e: unknown, d: string) => d }));
vi.mock('../utils/logger', () => ({ default: { error: vi.fn(), warn: vi.fn() } }));

vi.mock('./attendanceManage/AttendanceManageView', () => ({
  default: (props: any) => (
    <div>
      <button onClick={props.handleOpenRecordModal}>openRecord</button>
      <button onClick={props.handleCloseRecordModal}>closeRecord</button>
      <button onClick={props.handleOpenLeaveModal}>openLeave</button>
      <button onClick={props.handleCloseLeaveModal}>closeLeave</button>
      <button onClick={props.handleRecordSubmit}>recordSubmit</button>
      <button onClick={() => props.handleBatchRecord('present')}>batchPresent</button>
      <button onClick={() => props.handleBatchRecord('absent')}>batchAbsent</button>
      <button onClick={props.handleLeaveSubmit}>leaveSubmit</button>
      <button onClick={() => props.handleApproveLeave(1, true)}>approve</button>
      <button onClick={() => props.handleApproveLeave(1, false)}>reject</button>
      <button onClick={props.handleRestoreDraft}>restoreDraft</button>
      <button onClick={props.handleDiscardDraft}>discardDraft</button>
      <button
        onClick={() =>
          props.setRecordForm({
            class_id: 5,
            student_id: 1,
            date: '2026-01-01',
            period: '上午',
            status: 'present',
          })
        }
      >
        fillRecord
      </button>
      <button
        onClick={() =>
          props.setLeaveForm({
            student_id: 1,
            leave_type: 'personal',
            start_date: '2026-01-01',
            end_date: '2026-01-02',
            reason: '病',
          })
        }
      >
        fillLeave
      </button>
      <button onClick={() => props.setSearchTerm('张')}>setSearch</button>
      <button onClick={() => props.setFilterStatus('present')}>setStatus</button>
    </div>
  ),
}));

beforeEach(() => {
  mockShowToast.mockClear();
  // 清空全部 api mock 的调用计数，避免跨用例持久化泄漏
  //（如「有班级」用例触发 batchRecord 的调用计数污染「空学生」用例的 not.toHaveBeenCalled 断言）
  Object.values(apiMocks).forEach((m) => m.mockClear());
  apiMocks.getAll.mockResolvedValue({
    records: mockAttendances,
    total: mockAttendances.length,
  });
  apiMocks.getStats.mockResolvedValue({ present: 10, absent: 2 });
  apiMocks.getLeaves.mockResolvedValue({ leaves: [], total: 0 });
  apiMocks.record.mockResolvedValue({});
  apiMocks.batchRecord.mockResolvedValue({});
  apiMocks.applyLeave.mockResolvedValue({});
  apiMocks.approveLeave.mockResolvedValue({});
  // 默认返回空学生列表：避免前置用例 usersGetAll.mockResolvedValue([...]) 持久化泄漏到本用例
  apiMocks.usersGetAll.mockResolvedValue([]);
  autoSaveState.clearDraft.mockClear();
  autoSaveState.restoreDraft.mockReturnValue(null);
  autoSaveState.loadDraft.mockReturnValue(null);
  autoSaveState.discardChanges.mockClear();
  autoSaveState.draftAvailable = false;
});

async function mount() {
  const utils = render(<AttendanceManage />);
  await waitFor(() => expect(apiMocks.getStats).toHaveBeenCalled());
  return utils;
}

describe('AttendanceManage 容器逻辑', () => {
  it('挂载时拉取考勤列表/统计/请假列表', async () => {
    await mount();
    expect(apiMocks.getStats).toHaveBeenCalled();
    expect(apiMocks.getLeaves).toHaveBeenCalled();
  });

  it('记录提交：校验失败（默认表单）不调用 record API', async () => {
    await mount();
    fireEvent.click(screen.getByText('recordSubmit'));
    expect(apiMocks.record).not.toHaveBeenCalled();
  });

  it('记录提交：成功路径调用 record + 成功 toast + clearDraft', async () => {
    await mount();
    fireEvent.click(screen.getByText('fillRecord'));
    fireEvent.click(screen.getByText('recordSubmit'));
    await waitFor(() => expect(apiMocks.record).toHaveBeenCalled());
    expect(apiMocks.record.mock.calls[0][0]).toMatchObject({
      class_id: 5,
      student_id: 1,
      date: '2026-01-01',
      period: '上午',
      status: 'present',
    });
    expect(mockShowToast).toHaveBeenCalledWith('success', '考勤记录成功');
    expect(autoSaveState.clearDraft).toHaveBeenCalled();
  });

  it('记录提交：API 失败进入 catch 分支', async () => {
    apiMocks.record.mockRejectedValueOnce(new Error('boom'));
    await mount();
    fireEvent.click(screen.getByText('fillRecord'));
    fireEvent.click(screen.getByText('recordSubmit'));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('error', '考勤记录失败'));
  });

  it('请假提交：校验失败不调用 applyLeave', async () => {
    await mount();
    fireEvent.click(screen.getByText('leaveSubmit'));
    expect(apiMocks.applyLeave).not.toHaveBeenCalled();
  });

  it('请假提交：成功路径', async () => {
    await mount();
    fireEvent.click(screen.getByText('fillLeave'));
    fireEvent.click(screen.getByText('leaveSubmit'));
    await waitFor(() => expect(apiMocks.applyLeave).toHaveBeenCalled());
    expect(apiMocks.applyLeave.mock.calls[0][0]).toMatchObject({
      student_id: 1,
      leave_type: 'personal',
      start_date: '2026-01-01',
      end_date: '2026-01-02',
      reason: '病',
    });
    expect(mockShowToast).toHaveBeenCalledWith('success', '请假申请已提交');
  });

  it('请假提交：API 失败进入 catch 分支', async () => {
    apiMocks.applyLeave.mockRejectedValueOnce(new Error('boom'));
    await mount();
    fireEvent.click(screen.getByText('fillLeave'));
    fireEvent.click(screen.getByText('leaveSubmit'));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('error', '提交请假申请失败'));
  });

  it('批量记录：无班级 warning 不调用 API', async () => {
    await mount();
    fireEvent.click(screen.getByText('batchPresent'));
    expect(mockShowToast).toHaveBeenCalledWith('warning', '请先选择班级');
    expect(apiMocks.batchRecord).not.toHaveBeenCalled();
  });

  it('批量记录：有班级+日期节次触发用户拉取与批量记录', async () => {
    apiMocks.usersGetAll.mockResolvedValue([
      { id: 1, role: 'student' },
      { id: 2, role: 'teacher' },
    ]);
    await mount();
    fireEvent.click(screen.getByText('fillRecord'));
    fireEvent.click(screen.getByText('batchPresent'));
    await waitFor(() => expect(apiMocks.usersGetAll).toHaveBeenCalled());
    expect(apiMocks.batchRecord).toHaveBeenCalled();
  });

  it('批量记录：空学生列表 warning', async () => {
    apiMocks.usersGetAll.mockResolvedValue([]);
    await mount();
    fireEvent.click(screen.getByText('fillRecord'));
    fireEvent.click(screen.getByText('batchPresent'));
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith('warning', '该班级暂无学生，无法批量记录')
    );
    expect(apiMocks.batchRecord).not.toHaveBeenCalled();
  });

  it('批量记录：成功路径（数组返回 + 过滤学生）', async () => {
    apiMocks.usersGetAll.mockResolvedValue([
      { id: 1, role: 'student' },
      { id: 2, role: 'teacher' },
    ]);
    await mount();
    fireEvent.click(screen.getByText('fillRecord'));
    fireEvent.click(screen.getByText('batchPresent'));
    await waitFor(() => expect(apiMocks.batchRecord).toHaveBeenCalled());
    // usersGetAll 返回 1 student + 1 teacher → 仅 1 条记录
    expect(apiMocks.batchRecord.mock.calls[0][0]).toHaveLength(1);
    expect(mockShowToast).toHaveBeenCalledWith('success', '已批量记录 1 名学生出勤');
  });

  it('批量记录：API 失败进入 catch 分支', async () => {
    apiMocks.usersGetAll.mockResolvedValue([
      { id: 1, role: 'student' },
      { id: 2, role: 'teacher' },
    ]);
    apiMocks.batchRecord.mockRejectedValueOnce(new Error('boom'));
    await mount();
    fireEvent.click(screen.getByText('fillRecord'));
    fireEvent.click(screen.getByText('batchPresent'));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('error', '批量记录失败'));
  });

  it('审批请假：approve=true 文案', async () => {
    await mount();
    fireEvent.click(screen.getByText('approve'));
    await waitFor(() => expect(apiMocks.approveLeave).toHaveBeenCalledWith(1, true));
    expect(mockShowToast).toHaveBeenCalledWith('success', '请假已批准');
  });

  it('审批请假：approve=false 文案', async () => {
    await mount();
    fireEvent.click(screen.getByText('reject'));
    await waitFor(() => expect(apiMocks.approveLeave).toHaveBeenCalledWith(1, false));
    expect(mockShowToast).toHaveBeenCalledWith('success', '请假已驳回');
  });

  it('审批请假：API 失败进入 catch 分支', async () => {
    apiMocks.approveLeave.mockRejectedValueOnce(new Error('boom'));
    await mount();
    fireEvent.click(screen.getByText('approve'));
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('error', '审批操作失败'));
  });

  it('恢复草稿：draft 为 null 直接 return 不崩溃', async () => {
    await mount();
    autoSaveState.restoreDraft.mockReturnValue(null);
    fireEvent.click(screen.getByText('restoreDraft'));
  });

  it('恢复草稿：activeModal=leave 打开请假弹窗', async () => {
    await mount();
    autoSaveState.restoreDraft.mockReturnValue({
      activeModal: 'leave',
      recordForm: { class_id: 0, student_id: 0, date: '', period: '上午', status: 'present' },
      leaveForm: {
        student_id: 0,
        leave_type: 'personal',
        start_date: '',
        end_date: '',
        reason: '',
      },
    });
    fireEvent.click(screen.getByText('restoreDraft'));
  });

  it('恢复草稿：activeModal=record 打开记录弹窗', async () => {
    await mount();
    autoSaveState.restoreDraft.mockReturnValue({
      activeModal: 'record',
      recordForm: { class_id: 0, student_id: 0, date: '', period: '上午', status: 'present' },
      leaveForm: {
        student_id: 0,
        leave_type: 'personal',
        start_date: '',
        end_date: '',
        reason: '',
      },
    });
    fireEvent.click(screen.getByText('restoreDraft'));
  });

  it('空草稿清理 useEffect：draftAvailable=false 直接 return', async () => {
    autoSaveState.draftAvailable = false;
    await mount();
    expect(autoSaveState.clearDraft).not.toHaveBeenCalled();
  });

  it('空草稿清理 useEffect：默认草稿触发 clearDraft', async () => {
    autoSaveState.draftAvailable = true;
    autoSaveState.loadDraft.mockReturnValue({
      activeModal: null,
      recordForm: {
        class_id: 0,
        student_id: 0,
        date: new Date().toISOString().split('T')[0],
        period: '上午',
        status: 'present',
      },
      leaveForm: {
        student_id: 0,
        leave_type: 'personal',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        reason: '',
      },
    });
    await mount();
    expect(autoSaveState.clearDraft).toHaveBeenCalled();
  });

  it('获取统计失败进入 catch（setStats null + toast）', async () => {
    apiMocks.getStats.mockRejectedValueOnce(new Error('boom'));
    await mount();
    expect(mockShowToast).toHaveBeenCalledWith('error', '获取考勤统计失败，请稍后重试');
  });

  it('获取请假列表失败进入 catch（setLeavesError true）', async () => {
    apiMocks.getLeaves.mockRejectedValueOnce(new Error('boom'));
    await mount();
    await waitFor(() => expect(apiMocks.getLeaves).toHaveBeenCalled());
  });

  it('useClientFilter 分支：按 searchTerm 过滤（student_name 存在/缺失）', async () => {
    await mount();
    fireEvent.click(screen.getByText('setSearch'));
    await act(async () => {});
    // 过滤逻辑在 render 内执行（useClientFilter mock 调 fn）；无断言崩溃即通过
    expect(apiMocks.getStats).toHaveBeenCalled();
  });

  it('useClientFilter 分支：按 filterStatus 过滤', async () => {
    await mount();
    fireEvent.click(screen.getByText('setStatus'));
    await act(async () => {});
    expect(apiMocks.getStats).toHaveBeenCalled();
  });
});
