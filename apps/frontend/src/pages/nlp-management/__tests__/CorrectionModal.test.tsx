import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CorrectionModal } from '../CorrectionModal';
import type { NLPDeps, ManualCorrectionData } from '../types';
import api from '../../../services/api';

// 模拟 services/api（CorrectionModal 在 useEffect 中调用 api.users.getAll 拉取学生列表）
vi.mock('../../../services/api', () => ({
  default: { users: { getAll: vi.fn() } },
}));

// 测试环境下 usePermissions 默认返回 loading/无权限 → PermissionButton disabled；
// 注入 isSuperAdmin:true 使「反馈并学习 / 保存并执行」按钮真实可点击。
vi.mock('../../../hooks', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    usePermissions: () => ({
      permissions: [],
      roles: [],
      isLoading: false,
      error: null,
      adminInfo: null,
      hasPermission: () => true,
      hasAnyPermission: () => true,
      hasAllPermissions: () => true,
      isSuperAdmin: true,
      isAdmin: false,
      reload: () => {},
    }),
  };
});

const studentList = [
  { id: 1, name: '张三', class_name: '一班' },
  { id: 2, name: '李四', class_name: '二班' },
];

function mockStudents(resolved: boolean) {
  if (resolved) {
    vi.mocked(api.users.getAll).mockResolvedValue({ data: studentList } as never);
  } else {
    vi.mocked(api.users.getAll).mockRejectedValue(new Error('network'));
  }
}

const baseManualCorrection: ManualCorrectionData = {
  intent: 'add',
  score_value: 5,
  behavior_tags: [],
  behavior_description: '',
  feedback_note: '',
  user_id: undefined,
  corrected_name: '',
};

const noop = vi.fn();

const baseDeps: {
  setShowCorrectionModal: typeof noop;
  inputText: string;
  manualCorrection: ManualCorrectionData;
  setManualCorrection: typeof noop;
  handleRecordFeedback: typeof noop;
  isSubmittingFeedback: boolean;
  handleManualExecute: typeof noop;
} = {
  setShowCorrectionModal: noop,
  inputText: '张三上课积极回答问题',
  manualCorrection: baseManualCorrection,
  setManualCorrection: noop,
  handleRecordFeedback: noop,
  isSubmittingFeedback: false,
  handleManualExecute: noop,
};

function renderWith(overrides: Partial<typeof baseDeps> = {}) {
  const deps = { ...baseDeps, ...overrides } as unknown as NLPDeps;
  return render(<CorrectionModal deps={deps} />);
}

describe('CorrectionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStudents(true);
  });

  it('渲染原输入文本与操作按钮', () => {
    const { container } = renderWith();
    expect(screen.getByText('手动修正')).toBeInTheDocument();
    expect(container.textContent).toContain('张三上课积极回答问题');
    expect(screen.getByText('取消')).toBeInTheDocument();
    expect(screen.getByText('反馈并学习')).toBeInTheDocument();
    expect(screen.getByText('保存并执行')).toBeInTheDocument();
  });

  it('useEffect 拉取学生成功：datalist 渲染选项 + 匹配 user_id 显示「已选」', async () => {
    const { container } = renderWith({
      manualCorrection: { ...baseManualCorrection, user_id: 1 },
    });
    await waitFor(() => {
      expect(container.querySelectorAll('datalist option').length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/已选：张三/)).toBeInTheDocument();
  });

  it('useEffect 拉取学生失败：catch 置空列表，无选项无「已选」', async () => {
    mockStudents(false);
    const { container } = renderWith();
    await waitFor(() => {
      expect(api.users.getAll).toHaveBeenCalled();
    });
    expect(container.querySelectorAll('datalist option').length).toBe(0);
    expect(screen.queryByText(/已选：/)).toBeNull();
  });

  it('学生输入匹配下拉项：setManualCorrection 写入 user_id', async () => {
    const setManual = vi.fn();
    const { container } = renderWith({ setManualCorrection: setManual });
    await waitFor(() => {
      expect(container.querySelectorAll('datalist option').length).toBeGreaterThan(0);
    });
    const input = container.querySelector(
      'input[list="manual-correction-students"]'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '张三（一班）' } });
    const call = setManual.mock.calls[0][0] as ManualCorrectionData;
    expect(call.user_id).toBe(1);
    expect(call.corrected_name).toBe('张三');
  });

  it('学生输入不匹配：setManualCorrection 写入 corrected_name、user_id 清空', async () => {
    const setManual = vi.fn();
    const { container } = renderWith({ setManualCorrection: setManual });
    await waitFor(() => {
      expect(container.querySelectorAll('datalist option').length).toBeGreaterThan(0);
    });
    const input = container.querySelector(
      'input[list="manual-correction-students"]'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '王五' } });
    const call = setManual.mock.calls[0][0] as ManualCorrectionData;
    expect(call.corrected_name).toBe('王五');
    expect(call.user_id).toBeUndefined();
  });

  it('评分意图按钮：点击「扣分」「其他」写入对应 intent', () => {
    const setManual = vi.fn();
    renderWith({ setManualCorrection: setManual });
    fireEvent.click(screen.getByText('扣分'));
    expect((setManual.mock.calls[0][0] as ManualCorrectionData).intent).toBe('deduct');
    fireEvent.click(screen.getByText('其他'));
    expect((setManual.mock.calls[1][0] as ManualCorrectionData).intent).toBe('other');
  });

  it('分数值输入：数字解析与非法值兜底为 0', () => {
    const setManual = vi.fn();
    const { container } = renderWith({ setManualCorrection: setManual });
    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '8' } });
    expect((setManual.mock.calls[0][0] as ManualCorrectionData).score_value).toBe(8);
    fireEvent.change(input, { target: { value: 'abc' } });
    expect((setManual.mock.calls[1][0] as ManualCorrectionData).score_value).toBe(0);
  });

  it('行为标签输入：逗号分隔 trim + 过滤空串', () => {
    const setManual = vi.fn();
    // 初始给非空 behavior_tags，确保两次变更都是「不同值跳变」，绕过受控输入值追踪陷阱
    renderWith({
      manualCorrection: { ...baseManualCorrection, behavior_tags: ['x'] },
      setManualCorrection: setManual,
    });
    const tagInput = screen.getByPlaceholderText('多个标签用逗号分隔') as HTMLInputElement;
    fireEvent.change(tagInput, { target: { value: 'a, b, , c' } });
    expect((setManual.mock.calls[0][0] as ManualCorrectionData).behavior_tags).toEqual([
      'a',
      'b',
      'c',
    ]);
    fireEvent.change(tagInput, { target: { value: '' } });
    expect((setManual.mock.calls[1][0] as ManualCorrectionData).behavior_tags).toEqual([]);
  });

  it('行为描述 / 反馈备注 文本域 onChange', () => {
    const setManual = vi.fn();
    const { container } = renderWith({ setManualCorrection: setManual });
    const textareas = container.querySelectorAll('textarea');
    fireEvent.change(textareas[0], { target: { value: '上课睡觉' } });
    expect((setManual.mock.calls[0][0] as ManualCorrectionData).behavior_description).toBe(
      '上课睡觉'
    );
    fireEvent.change(textareas[1], { target: { value: '需复核' } });
    expect((setManual.mock.calls[1][0] as ManualCorrectionData).feedback_note).toBe('需复核');
  });

  it('取消按钮：setShowCorrectionModal(false)', () => {
    const setModal = vi.fn();
    renderWith({ setShowCorrectionModal: setModal });
    fireEvent.click(screen.getByText('取消'));
    expect(setModal).toHaveBeenCalledWith(false);
  });

  it('「反馈并学习」按钮点击：handleRecordFeedback 调用', () => {
    const feedback = vi.fn();
    renderWith({ handleRecordFeedback: feedback });
    fireEvent.click(screen.getByText('反馈并学习'));
    expect(feedback).toHaveBeenCalledTimes(1);
  });

  it('「反馈并学习」disabled（isSubmittingFeedback=true）：按钮禁用不触发回调', () => {
    const feedback = vi.fn();
    renderWith({ handleRecordFeedback: feedback, isSubmittingFeedback: true });
    const btn = screen.getByRole('button', { name: /反馈中/ });
    expect(btn).toBeDisabled();
    expect(feedback).not.toHaveBeenCalled();
  });

  it('「保存并执行」按钮点击：handleManualExecute 调用', () => {
    const exec = vi.fn();
    renderWith({ handleManualExecute: exec });
    fireEvent.click(screen.getByText('保存并执行'));
    expect(exec).toHaveBeenCalledTimes(1);
  });
});
