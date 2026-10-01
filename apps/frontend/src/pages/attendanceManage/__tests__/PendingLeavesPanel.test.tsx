import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PendingLeavesPanel from '../PendingLeavesPanel';
import type { LeaveApplication } from '../../../types';
import type { RunSubmit } from '../types';

const runSubmit = vi.fn((fn: () => void) => {
  if (typeof fn === 'function') fn();
}) as unknown as RunSubmit;

interface PanelTestProps {
  leavesError?: boolean;
  pendingLeaves?: LeaveApplication[];
  submitting?: boolean;
  handleApproveLeave?: (leaveId: number, approve: boolean) => void;
  runSubmit?: RunSubmit;
  setShowLeavesPanel?: (v: boolean) => void;
  leavesPage?: number;
  leavesTotal?: number;
  setLeavesPage?: (p: number) => void;
}

function makePanelProps(overrides: PanelTestProps = {}) {
  return {
    leavesError: false,
    pendingLeaves: [],
    submitting: false,
    handleApproveLeave: vi.fn(),
    runSubmit,
    setShowLeavesPanel: vi.fn(),
    leavesPage: 1,
    leavesTotal: 0,
    setLeavesPage: vi.fn(),
    ...overrides,
  };
}

const leaveWithName: LeaveApplication = {
  id: 1,
  student_id: 1,
  student_name: '张三',
  leave_type: '病假',
  start_date: '2026-01-01',
  end_date: '2026-01-02',
  reason: '感冒',
} as LeaveApplication;

const leaveWithoutName: LeaveApplication = {
  id: 2,
  student_id: 2,
  student_name: '' as unknown as string,
  leave_type: '事假',
  start_date: '2026-02-01',
  end_date: '2026-02-02',
  reason: '',
} as LeaveApplication;

describe('PendingLeavesPanel 待审批请假面板', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('加载失败态显示错误提示', () => {
    render(<PendingLeavesPanel {...makePanelProps({ leavesError: true })} />);
    expect(screen.getByText('请假列表加载失败')).toBeInTheDocument();
  });

  it('空列表显示占位', () => {
    render(<PendingLeavesPanel {...makePanelProps({ pendingLeaves: [] })} />);
    expect(screen.getByText('暂无待审批的请假申请')).toBeInTheDocument();
  });

  it('渲染请假项并支持批准 / 驳回', () => {
    const props = makePanelProps({ pendingLeaves: [leaveWithName] });
    render(<PendingLeavesPanel {...props} />);
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('病假 · 2026-01-01 至 2026-01-02 · 感冒')).toBeInTheDocument();

    fireEvent.click(screen.getByText('批准'));
    expect(props.runSubmit).toHaveBeenCalled();
    expect(props.handleApproveLeave).toHaveBeenCalledWith(1, true);

    fireEvent.click(screen.getByText('驳回'));
    expect(props.handleApproveLeave).toHaveBeenCalledWith(1, false);
  });

  it('无姓名时回退显示 学生 #id', () => {
    render(<PendingLeavesPanel {...makePanelProps({ pendingLeaves: [leaveWithoutName] })} />);
    expect(screen.getByText('学生 #2')).toBeInTheDocument();
    expect(screen.getByText('事假 · 2026-02-01 至 2026-02-02')).toBeInTheDocument();
  });

  it('关闭面板调用 setShowLeavesPanel(false)', () => {
    const props = makePanelProps({ pendingLeaves: [leaveWithName] });
    render(<PendingLeavesPanel {...props} />);
    fireEvent.click(screen.getByLabelText('关闭待审批面板'));
    expect(props.setShowLeavesPanel).toHaveBeenCalledWith(false);
  });

  it('总数超过 50 渲染分页并切换页码', () => {
    const props = makePanelProps({ pendingLeaves: [leaveWithName], leavesTotal: 120 });
    render(<PendingLeavesPanel {...props} />);
    const pageTwo = screen.getByText('2');
    expect(pageTwo).toBeInTheDocument();
    fireEvent.click(pageTwo);
    expect(props.setLeavesPage).toHaveBeenCalledWith(2);
  });
});
