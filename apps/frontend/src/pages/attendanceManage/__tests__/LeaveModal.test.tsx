import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LeaveModal from '../LeaveModal';
import type { LeaveFormData, SetLeaveForm, RunSubmit } from '../types';

// StudentSelect / DateRangeField 为网络/复杂依赖组件，测试环境桩为本地受控输入。
vi.mock('../../../components', () => ({
  StudentSelect: ({ value, onChange, emptyLabel }: any) => (
    <select
      data-testid='student-select'
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      <option value=''>{emptyLabel}</option>
      <option value='2'>学生2</option>
    </select>
  ),
  DateRangeField: ({
    startValue,
    endValue,
    onStartChange,
    onEndChange,
    startError,
    endError,
  }: any) => (
    <div data-testid='date-range'>
      <input
        aria-label='start'
        value={startValue}
        onChange={(e) => onStartChange(e.target.value)}
      />
      <input aria-label='end' value={endValue} onChange={(e) => onEndChange(e.target.value)} />
      {startError && <p data-testid='start-error'>{startError}</p>}
      {endError && <p data-testid='end-error'>{endError}</p>}
    </div>
  ),
}));

const runSubmit = vi.fn((fn: () => void) => {
  if (typeof fn === 'function') fn();
}) as unknown as RunSubmit;

const baseLeaveForm: LeaveFormData = {
  student_id: 0,
  leave_type: 'personal',
  start_date: '',
  end_date: '',
  reason: '',
};

interface LeaveTestProps {
  closeLeaveModal?: () => void;
  leaveForm?: LeaveFormData;
  setLeaveForm?: SetLeaveForm;
  errors?: Partial<Record<string, string>>;
  submitting?: boolean;
  handleLeaveSubmit?: () => void;
  runSubmit?: RunSubmit;
}

function makeLeaveProps(overrides: LeaveTestProps = {}) {
  return {
    closeLeaveModal: vi.fn(),
    leaveForm: baseLeaveForm,
    setLeaveForm: vi.fn(),
    errors: {},
    submitting: false,
    handleLeaveSubmit: vi.fn(),
    runSubmit,
    ...overrides,
  };
}

describe('LeaveModal 请假申请弹窗', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染标题与关键字段', () => {
    render(<LeaveModal {...makeLeaveProps()} />);
    expect(screen.getByText('请假申请')).toBeInTheDocument();
    expect(screen.getByText('学生')).toBeInTheDocument();
    expect(screen.getByText('请假类型')).toBeInTheDocument();
    expect(screen.getByText('请假原因')).toBeInTheDocument();
  });

  it('点击 X 按钮关闭弹窗', () => {
    const props = makeLeaveProps();
    render(<LeaveModal {...props} />);
    fireEvent.click(screen.getByLabelText('关闭请假申请弹窗'));
    expect(props.closeLeaveModal).toHaveBeenCalled();
  });

  it('点击取消关闭弹窗', () => {
    const props = makeLeaveProps();
    render(<LeaveModal {...props} />);
    fireEvent.click(screen.getByText('取消'));
    expect(props.closeLeaveModal).toHaveBeenCalled();
  });

  it('修改学生 / 请假类型 / 日期 / 原因触发 setLeaveForm', () => {
    const props = makeLeaveProps();
    render(<LeaveModal {...props} />);
    fireEvent.change(screen.getByTestId('student-select'), { target: { value: '2' } });
    fireEvent.change(screen.getByDisplayValue('事假'), { target: { value: '病假' } });
    fireEvent.change(screen.getByLabelText('start'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('end'), { target: { value: '2026-01-02' } });
    fireEvent.change(screen.getByPlaceholderText('请输入请假原因'), { target: { value: '感冒' } });
    expect(props.setLeaveForm).toHaveBeenCalledTimes(5);
  });

  it('提交申请调用 handleLeaveSubmit', () => {
    const props = makeLeaveProps();
    render(<LeaveModal {...props} />);
    fireEvent.click(screen.getByText('提交申请'));
    expect(props.runSubmit).toHaveBeenCalledWith(props.handleLeaveSubmit);
    expect(props.handleLeaveSubmit).toHaveBeenCalled();
  });

  it('提交中态显示提交中', () => {
    render(<LeaveModal {...makeLeaveProps({ submitting: true })} />);
    expect(screen.getByText('提交中...')).toBeInTheDocument();
  });

  it('错误态显示字段错误信息', () => {
    render(
      <LeaveModal
        {...makeLeaveProps({ errors: { student_id: '学生必填', start_date: '起始必填' } })}
      />
    );
    expect(screen.getByText('学生必填')).toBeInTheDocument();
    expect(screen.getByText('起始必填')).toBeInTheDocument();
  });
});
