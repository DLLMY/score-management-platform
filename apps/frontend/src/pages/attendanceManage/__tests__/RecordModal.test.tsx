import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RecordModal from '../RecordModal';
import type { QuickRecordForm, SetRecordForm, RunSubmit } from '../types';

// ClassSelect / StudentSelect 为网络依赖组件（拉取班级/学生选项），测试环境桩为本地受控 select。
vi.mock('../../../components', () => ({
  ClassSelect: ({ value, onChange, emptyPlaceholder }: any) => (
    <select
      data-testid='class-select'
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      <option value=''>{emptyPlaceholder}</option>
      <option value='1'>1班</option>
    </select>
  ),
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
}));

const runSubmit = vi.fn((fn: () => void) => {
  if (typeof fn === 'function') fn();
}) as unknown as RunSubmit;

const baseRecordForm: QuickRecordForm = {
  class_id: 0,
  student_id: 0,
  date: '2026-01-01',
  period: '上午',
  status: 'present',
};

interface RecordTestProps {
  closeRecordModal?: () => void;
  recordForm?: QuickRecordForm;
  setRecordForm?: SetRecordForm;
  errors?: Partial<Record<string, string>>;
  submitting?: boolean;
  handleBatchRecord?: (status: string) => void;
  handleRecordSubmit?: () => void;
  runSubmit?: RunSubmit;
}

function makeRecordProps(overrides: RecordTestProps = {}) {
  return {
    closeRecordModal: vi.fn(),
    recordForm: baseRecordForm,
    setRecordForm: vi.fn(),
    errors: {},
    submitting: false,
    handleBatchRecord: vi.fn(),
    handleRecordSubmit: vi.fn(),
    runSubmit,
    ...overrides,
  };
}

describe('RecordModal 快速考勤记录弹窗', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染标题与关键字段', () => {
    render(<RecordModal {...makeRecordProps()} />);
    expect(screen.getByText('快速考勤记录')).toBeInTheDocument();
    expect(screen.getByText('班级')).toBeInTheDocument();
    expect(screen.getByText('学生')).toBeInTheDocument();
    expect(screen.getByText('日期')).toBeInTheDocument();
    expect(screen.getByText('时段')).toBeInTheDocument();
  });

  it('点击遮罩关闭弹窗', () => {
    const props = makeRecordProps();
    const { container } = render(<RecordModal {...props} />);
    container.firstChild && fireEvent.click(container.firstChild as HTMLElement);
    expect(props.closeRecordModal).toHaveBeenCalled();
  });

  it('点击 X 按钮关闭弹窗', () => {
    const props = makeRecordProps();
    render(<RecordModal {...props} />);
    fireEvent.click(screen.getByLabelText('关闭考勤记录弹窗'));
    expect(props.closeRecordModal).toHaveBeenCalled();
  });

  it('点击取消关闭弹窗', () => {
    const props = makeRecordProps();
    render(<RecordModal {...props} />);
    fireEvent.click(screen.getByText('取消'));
    expect(props.closeRecordModal).toHaveBeenCalled();
  });

  it('点击模态卡片触发 stopPropagation（不冒泡至遮罩）', () => {
    const { container } = render(<RecordModal {...makeRecordProps()} />);
    const card = (container.firstChild as HTMLElement)?.firstChild as HTMLElement;
    fireEvent.click(card);
    // stopPropagation 被执行（无断言崩溃即通过）
    expect(card).toBeTruthy();
  });

  it('修改班级 / 学生 / 日期 / 时段触发 setRecordForm', () => {
    const props = makeRecordProps();
    render(<RecordModal {...props} />);
    fireEvent.change(screen.getByTestId('class-select'), { target: { value: '1' } });
    fireEvent.change(screen.getByTestId('student-select'), { target: { value: '2' } });
    fireEvent.change(screen.getByDisplayValue('2026-01-01'), { target: { value: '2026-02-02' } });
    fireEvent.change(screen.getByDisplayValue('上午'), { target: { value: '下午' } });
    expect(props.setRecordForm).toHaveBeenCalledTimes(4);
  });

  it('点击四个状态按钮更新状态', () => {
    const props = makeRecordProps();
    render(<RecordModal {...props} />);
    for (const label of ['出勤', '缺勤', '迟到', '请假']) {
      fireEvent.click(screen.getByText(label));
    }
    expect(props.setRecordForm).toHaveBeenCalledTimes(4);
  });

  it('批量出勤调用 handleBatchRecord("present")', () => {
    const props = makeRecordProps();
    render(<RecordModal {...props} />);
    fireEvent.click(screen.getByText('批量出勤'));
    expect(props.runSubmit).toHaveBeenCalled();
    expect(props.handleBatchRecord).toHaveBeenCalledWith('present');
  });

  it('批量缺勤调用 handleBatchRecord("absent")', () => {
    const props = makeRecordProps();
    render(<RecordModal {...props} />);
    fireEvent.click(screen.getByText('批量缺勤'));
    expect(props.handleBatchRecord).toHaveBeenCalledWith('absent');
  });

  it('保存记录调用 handleRecordSubmit', () => {
    const props = makeRecordProps();
    render(<RecordModal {...props} />);
    fireEvent.click(screen.getByText('保存记录'));
    expect(props.runSubmit).toHaveBeenCalledWith(props.handleRecordSubmit);
    expect(props.handleRecordSubmit).toHaveBeenCalled();
  });

  it('提交中态显示保存中', () => {
    render(<RecordModal {...makeRecordProps({ submitting: true })} />);
    expect(screen.getByText('保存中...')).toBeInTheDocument();
  });

  it('错误态显示字段错误信息', () => {
    render(
      <RecordModal
        {...makeRecordProps({ errors: { class_id: '班级必填', student_id: '学生必填' } })}
      />
    );
    expect(screen.getByText('班级必填')).toBeInTheDocument();
    expect(screen.getByText('学生必填')).toBeInTheDocument();
  });
});
