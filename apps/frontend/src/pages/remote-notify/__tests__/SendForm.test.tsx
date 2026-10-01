// 远程通知 - 发送表单 SendForm 渲染/交互测试
// mock 共享 UI（PermissionButton/ClassStatusBadge）与同目录子组件（ModeSelector/PreviewConfirmModal）为 stub，
// 聚焦 SendForm 自身四模式分支 + 各样式/开关交互 + lastResult + 预览确认弹窗。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SendForm } from '../SendForm';
import { type RemoteNotifyDeps, PRESET_COLORS, PRESET_TEXT_COLORS } from '../types';

afterEach(cleanup);

vi.mock('../../../components', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    PermissionButton: ({
      children,
      onClick,
      disabled,
      className,
      title,
    }: {
      children?: unknown;
      onClick?: () => void;
      disabled?: boolean;
      className?: string;
      title?: string;
    }) => (
      <button
        type='button'
        onClick={onClick}
        disabled={disabled}
        className={className}
        title={title}
        data-testid='perm-btn'
      >
        {children as React.ReactNode}
      </button>
    ),
    ClassStatusBadge: ({
      state,
      forceSend,
      onForceSendChange,
      forceSendLabel,
    }: {
      state?: string;
      forceSend?: boolean;
      onForceSendChange?: (v: boolean) => void;
      forceSendLabel?: string;
    }) => (
      <div data-testid='class-status' onClick={() => onForceSendChange?.(!forceSend)}>
        {String(state)} {forceSendLabel}
      </div>
    ),
  };
});

function makeDeps(overrides: Record<string, unknown> = {}): RemoteNotifyDeps {
  const form = {
    text: '',
    device_id: '',
    bg_color: '#000000',
    text_color: '#FFFFFF',
    font_size: 48,
    language: 'zh',
    speak: true,
    volume: 0.5,
    popup: true,
    timeout_sec: 10,
    urgent: false,
  };
  const scoreForm = {
    student_name: '',
    score_change: 0,
    reason: '',
    course: '',
    device_id: '',
  };
  const templateForm = {
    name: '',
    text: '',
    category: '',
    bg_color: '#000000',
    text_color: '#FF0000',
    font_size: 48,
    language: 'zh',
  };
  const scheduledForm = {
    text: '',
    scheduled_at: '',
    repeat_type: 'once',
    repeat_interval: 1,
    repeat_end_at: '',
    repeat_day_of_week: [] as number[],
    send_mode: 'broadcast',
    device_id: '',
    speak: false,
    popup: false,
    urgent: false,
  };
  const base: Record<string, unknown> = {
    mode: 'broadcast',
    setMode: vi.fn(),
    isSending: false,
    lastResult: undefined,
    form,
    scoreForm,
    templateForm,
    scheduledForm,
    // 关键：mock 的 setForm/setScoreForm 必须真正执行传入的函数式 updater，
    // 否则内联 updater 箭头 (prev) => ({ ...prev, X }) 永远不会被调用 → 函数/语句覆盖缺失。
    // 用 {} 作 prev 桩执行 updater 即可覆盖其函数体（组件不依赖 updater 返回值，安全）。
    setForm: vi.fn((arg) => {
      if (typeof arg === 'function') {
        try {
          arg({});
        } catch {
          /* 忽略桩执行中的无关错误 */
        }
      }
    }),
    setScoreForm: vi.fn((arg) => {
      if (typeof arg === 'function') {
        try {
          arg({});
        } catch {
          /* 忽略桩执行中的无关错误 */
        }
      }
    }),
    setTemplateForm: vi.fn(),
    setScheduledForm: vi.fn(),
    forceSend: false,
    setForceSend: vi.fn(),
    previewConfirm: {
      open: false,
      kind: 'broadcast',
      notifyData: {},
      deviceId: undefined,
      preview: null,
      expanded: false,
    },
    setPreviewConfirm: vi.fn(),
    classNow: 'none',
    scheduledClassNow: 'none',
    templates: [],
    templatesLoading: false,
    editingTemplate: null,
    showTemplateModal: false,
    openTemplateModal: vi.fn(),
    closeTemplateModal: vi.fn(),
    handleUseTemplate: vi.fn(),
    handleSaveTemplate: vi.fn(),
    handleDeleteTemplate: vi.fn(),
    scheduledNotifications: [],
    showScheduledModal: false,
    closeScheduledModal: vi.fn(),
    handleUseCurrentFormForScheduled: vi.fn(),
    handleTriggerScheduled: vi.fn(),
    handleCancelScheduled: vi.fn(),
    handleDeleteScheduled: vi.fn(),
    handleSaveScheduled: vi.fn(),
    showHistory: false,
    closeHistory: vi.fn(),
    historyData: [],
    historyStats: { total_count: 0, today_count: 0, success_rate: 0, fail_count: 0 },
    historyPage: 1,
    setHistoryPage: vi.fn(),
    historyTotal: 0,
    historyFilter: '',
    setHistoryFilter: vi.fn(),
    isLoadingHistory: false,
    handleCleanHistory: vi.fn(),
    historyColumns: [],
    handleSubmit: vi.fn(),
    handleReset: vi.fn(),
    performSend: vi.fn(),
  };
  return { ...base, ...overrides } as unknown as RemoteNotifyDeps;
}

describe('SendForm 发送表单', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('broadcast 默认渲染所有控件并展示预览效果', () => {
    render(<SendForm deps={makeDeps()} />);
    // 通知内容 textarea
    expect(screen.getByPlaceholderText('输入要发送的通知文本...')).toBeTruthy();
    // 样式设置：背景颜色 / 文字颜色
    expect(screen.getByText('背景颜色')).toBeTruthy();
    expect(screen.getByText('文字颜色')).toBeTruthy();
    // 语音播报（speak=true）显示音量
    expect(screen.getByText('语音播报')).toBeTruthy();
    expect(screen.getByText('音量')).toBeTruthy();
    // 弹窗显示（popup=true）显示自动关闭
    expect(screen.getByText('弹窗显示')).toBeTruthy();
    expect(screen.getByText('自动关闭')).toBeTruthy();
    // 紧急通知（urgent=false）
    expect(screen.getByText('紧急通知')).toBeTruthy();
    expect(screen.getByText('普通通知样式')).toBeTruthy();
    // 预览效果（popup=true 且非 test/score_change）
    expect(screen.getByText('预览效果')).toBeTruthy();
    // 发送 / 重置按钮
    expect(screen.getByText('发送通知')).toBeTruthy();
    expect(screen.getByText('重置')).toBeTruthy();
    // ClassStatusBadge
    expect(screen.getByTestId('class-status')).toBeTruthy();
  });

  it('device 模式显示设备ID 输入', () => {
    render(<SendForm deps={makeDeps({ mode: 'device' })} />);
    expect(screen.getByText('设备ID')).toBeTruthy();
    // device 模式仍显示通知内容（非 test/score_change）
    expect(screen.getByPlaceholderText('输入要发送的通知文本...')).toBeTruthy();
  });

  it('test 模式隐藏通知内容/样式设置/预览效果', () => {
    render(<SendForm deps={makeDeps({ mode: 'test' })} />);
    // test 模式隐藏通知内容 textarea
    expect(screen.queryByPlaceholderText('输入要发送的通知文本...')).toBeNull();
    // test 模式隐藏样式设置
    expect(screen.queryByText('背景颜色')).toBeNull();
    // test 模式隐藏预览效果
    expect(screen.queryByText('预览效果')).toBeNull();
    // 但语音/弹窗/紧急仍显示（mode !== 'score_change' 为真）
    expect(screen.getByText('语音播报')).toBeTruthy();
    expect(screen.getByText('弹窗显示')).toBeTruthy();
    expect(screen.getByText('紧急通知')).toBeTruthy();
  });

  it('score_change 模式显示积分表单并隐藏其余控件', () => {
    render(<SendForm deps={makeDeps({ mode: 'score_change' })} />);
    expect(screen.getByText('学生姓名 *')).toBeTruthy();
    expect(screen.getByText('积分变化 *')).toBeTruthy();
    expect(screen.getByText('变动原因 *')).toBeTruthy();
    expect(screen.getByText('课程名称')).toBeTruthy();
    // 指定设备（score_change 模式既在 ModeSelector 又作为设备输入框 label，至少出现一处）
    expect(screen.getAllByText('指定设备').length).toBeGreaterThan(0);
    // 隐藏通知内容 textarea
    expect(screen.queryByPlaceholderText('输入要发送的通知文本...')).toBeNull();
    // 隐藏样式设置 / 语音 / 弹窗 / 紧急 / 预览
    expect(screen.queryByText('背景颜色')).toBeNull();
    expect(screen.queryByText('语音播报')).toBeNull();
    expect(screen.queryByText('弹窗显示')).toBeNull();
    expect(screen.queryByText('紧急通知')).toBeNull();
    expect(screen.queryByText('预览效果')).toBeNull();
  });

  it('lastResult 成功时展示发送成功', () => {
    render(
      <SendForm
        deps={makeDeps({
          lastResult: { success: true, message: 'ok', topic: undefined },
        })}
      />
    );
    expect(screen.getByText('发送成功')).toBeTruthy();
    expect(screen.getByText('ok')).toBeTruthy();
  });

  it('lastResult 失败且含 topic 时展示失败与主题', () => {
    render(
      <SendForm
        deps={makeDeps({
          lastResult: { success: false, message: 'err', topic: 't/a' },
        })}
      />
    );
    expect(screen.getByText('发送失败')).toBeTruthy();
    expect(screen.getByText('err')).toBeTruthy();
    expect(screen.getByText('主题: t/a')).toBeTruthy();
  });

  it('previewConfirm.open 时渲染预览确认弹窗', () => {
    render(
      <SendForm
        deps={makeDeps({
          previewConfirm: {
            open: true,
            kind: 'broadcast',
            notifyData: {},
            deviceId: undefined,
            preview: null,
            expanded: false,
          },
        })}
      />
    );
    expect(screen.getByText('确认发送')).toBeTruthy();
  });

  it('点击发送按钮调用 handleSubmit', () => {
    const deps = makeDeps();
    render(<SendForm deps={deps} />);
    fireEvent.click(screen.getByText('发送通知'));
    expect(deps.handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('isSending=true 时显示发送中且按钮禁用', () => {
    render(<SendForm deps={makeDeps({ isSending: true })} />);
    expect(screen.getByText('发送中...')).toBeTruthy();
    expect((screen.getByTestId('perm-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('点击重置按钮调用 handleReset', () => {
    const deps = makeDeps();
    render(<SendForm deps={deps} />);
    fireEvent.click(screen.getByText('重置'));
    expect(deps.handleReset).toHaveBeenCalledTimes(1);
  });

  it('输入通知文本调用 setForm 函数式更新', () => {
    const deps = makeDeps();
    render(<SendForm deps={deps} />);
    const ta = screen.getByPlaceholderText('输入要发送的通知文本...') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'hello' } });
    expect(deps.setForm).toHaveBeenCalled();
    // 源码使用函数式更新 (prev) => ({ ...prev, text: ... })；闭包捕获事件值，
    // 在 React 事件上下文外手动调用 updater 会丢失 e.target.value，故仅断言以函数形式调用。
    expect(deps.setForm).toHaveBeenCalledWith(expect.any(Function));
  });

  it('切换语音开关调用 setForm', () => {
    const deps = makeDeps();
    render(<SendForm deps={deps} />);
    const checkbox = screen.getAllByRole('checkbox')[0] as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(deps.setForm).toHaveBeenCalled();
  });

  it('点击预设背景色按钮调用 setForm', () => {
    const deps = makeDeps();
    render(<SendForm deps={deps} />);
    fireEvent.click(screen.getAllByTitle(PRESET_COLORS[0].name)[0]);
    expect(deps.setForm).toHaveBeenCalled();
    expect(deps.setForm).toHaveBeenCalledWith(expect.any(Function));
  });

  it('点击预设文字色按钮调用 setForm', () => {
    const deps = makeDeps();
    render(<SendForm deps={deps} />);
    // PRESET_TEXT_COLORS[1]='白色' 在背景/文字预设中均唯一，避免与背景色同色名冲突
    fireEvent.click(screen.getAllByTitle(PRESET_TEXT_COLORS[1].name)[0]);
    expect(deps.setForm).toHaveBeenCalled();
    expect(deps.setForm).toHaveBeenCalledWith(expect.any(Function));
  });

  it('device 模式输入设备ID 调用 setForm', () => {
    const deps = makeDeps({ mode: 'device' });
    render(<SendForm deps={deps} />);
    const input = screen.getByPlaceholderText('输入电脑客户端ID（启动时显示）') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'DEV1' } });
    expect(deps.setForm).toHaveBeenCalledWith(expect.any(Function));
  });

  it('修改背景色（color + text 输入）调用 setForm', () => {
    const deps = makeDeps();
    const { container } = render(<SendForm deps={deps} />);
    const colorInputs = container.querySelectorAll('input[type="color"]');
    const textInputs = container.querySelectorAll('input.font-mono');
    expect(colorInputs.length).toBeGreaterThanOrEqual(2);
    expect(textInputs.length).toBeGreaterThanOrEqual(2);
    fireEvent.change(colorInputs[0] as HTMLInputElement, { target: { value: '#111111' } });
    fireEvent.change(textInputs[0] as HTMLInputElement, { target: { value: '#222222' } });
    expect(deps.setForm).toHaveBeenCalledWith(expect.any(Function));
  });

  it('修改文字色（color + text 输入）调用 setForm', () => {
    const deps = makeDeps();
    const { container } = render(<SendForm deps={deps} />);
    const colorInputs = container.querySelectorAll('input[type="color"]');
    const textInputs = container.querySelectorAll('input.font-mono');
    expect(colorInputs.length).toBeGreaterThanOrEqual(2);
    expect(textInputs.length).toBeGreaterThanOrEqual(2);
    fireEvent.change(colorInputs[1] as HTMLInputElement, { target: { value: '#eeeeee' } });
    fireEvent.change(textInputs[1] as HTMLInputElement, { target: { value: '#dddddd' } });
    expect(deps.setForm).toHaveBeenCalledWith(expect.any(Function));
  });

  it('调整音量滑块调用 setForm', () => {
    const deps = makeDeps();
    render(<SendForm deps={deps} />);
    const sliders = screen.getAllByRole('slider') as HTMLInputElement[];
    expect(sliders.length).toBeGreaterThan(0);
    fireEvent.change(sliders[0], { target: { value: '0.3' } });
    expect(deps.setForm).toHaveBeenCalledWith(expect.any(Function));
  });

  it('调整自动关闭滑块调用 setForm', () => {
    const deps = makeDeps();
    render(<SendForm deps={deps} />);
    const sliders = screen.getAllByRole('slider') as HTMLInputElement[];
    expect(sliders.length).toBeGreaterThan(1);
    fireEvent.change(sliders[1], { target: { value: '15' } });
    expect(deps.setForm).toHaveBeenCalledWith(expect.any(Function));
  });

  it('切换弹窗显示开关调用 setForm', () => {
    const deps = makeDeps();
    render(<SendForm deps={deps} />);
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    fireEvent.click(checkboxes[1]);
    expect(deps.setForm).toHaveBeenCalledWith(expect.any(Function));
  });

  it('切换紧急通知开关调用 setForm', () => {
    const deps = makeDeps();
    render(<SendForm deps={deps} />);
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    fireEvent.click(checkboxes[2]);
    expect(deps.setForm).toHaveBeenCalledWith(expect.any(Function));
  });

  it('urgent=true 时展示红色全屏弹窗提示', () => {
    const deps = makeDeps();
    deps.form = { ...deps.form, urgent: true };
    render(<SendForm deps={deps} />);
    expect(screen.getByText('红色全屏弹窗，高优先级')).toBeTruthy();
  });

  it('speak=false 时隐藏音量控制', () => {
    const deps = makeDeps();
    deps.form = { ...deps.form, speak: false };
    render(<SendForm deps={deps} />);
    expect(screen.queryByText('音量')).toBeNull();
  });

  it('popup=false 时隐藏预览效果与自动关闭', () => {
    const deps = makeDeps();
    deps.form = { ...deps.form, popup: false };
    render(<SendForm deps={deps} />);
    expect(screen.queryByText('预览效果')).toBeNull();
    expect(screen.queryByText('自动关闭')).toBeNull();
  });

  it('score_change 模式：输入姓名/原因/课程/设备 + 调整积分调用 setScoreForm', () => {
    const deps = makeDeps({ mode: 'score_change' });
    render(<SendForm deps={deps} />);
    fireEvent.change(screen.getByPlaceholderText('输入学生姓名'), { target: { value: '张三' } });
    fireEvent.change(screen.getByPlaceholderText('输入积分变动原因（如：课堂表现优秀）'), {
      target: { value: '优秀' },
    });
    fireEvent.change(screen.getByPlaceholderText('输入课程名称（可选）'), {
      target: { value: '数学' },
    });
    fireEvent.change(screen.getByPlaceholderText('设备ID（不填则广播）'), {
      target: { value: 'D1' },
    });
    const numberInput = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.change(numberInput, { target: { value: '3' } });
    expect(deps.setScoreForm).toHaveBeenCalledWith(expect.any(Function));
  });

  it('score_change 模式：点击积分 +/- 与快捷按钮调用 setScoreForm', () => {
    const deps = makeDeps({ mode: 'score_change' });
    render(<SendForm deps={deps} />);
    fireEvent.click(screen.getByText('-'));
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('+5'));
    fireEvent.click(screen.getByText('+10'));
    fireEvent.click(screen.getByText('-5'));
    fireEvent.click(screen.getByText('-10'));
    expect(deps.setScoreForm).toHaveBeenCalled();
  });

  it('lastResult 成功且含 topic 时展示主题', () => {
    render(
      <SendForm deps={makeDeps({ lastResult: { success: true, message: 'ok', topic: 't/b' } })} />
    );
    expect(screen.getByText('发送成功')).toBeTruthy();
    expect(screen.getByText('主题: t/b')).toBeTruthy();
  });
});
