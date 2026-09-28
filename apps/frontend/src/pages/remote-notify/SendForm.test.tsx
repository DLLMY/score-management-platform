// B47 覆盖率补测：SendForm 纯展示组件（remote-notify 右侧发送表单）
// mock 重型兄弟组件 ModeSelector / PreviewConfirmModal / ../../components（PermissionButton+ClassStatusBadge），
// 构造类型安全 deps 逐 mode/form 状态触发全部条件分支。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SendForm } from './SendForm';
import {
  DEFAULT_NOTIFY_FORM,
  DEFAULT_SCORE_FORM,
  DEFAULT_TEMPLATE_FORM,
  DEFAULT_SCHEDULED_FORM,
  type RemoteNotifyDeps,
  type ClassNowStatus,
} from './types';
import type { ColumnType } from '../../components';

// 兄弟组件桩：隔离 SendForm 本身覆盖
vi.mock('./ModeSelector', () => ({
  ModeSelector: () => <div data-testid='mode-selector'>MODE_SELECTOR</div>,
}));
vi.mock('./PreviewConfirmModal', () => ({
  PreviewConfirmModal: () => <div data-testid='preview-modal'>PREVIEW_MODAL</div>,
}));
vi.mock('../../components', () => ({
  PermissionButton: ({ onClick, disabled, children }: any) => (
    <button type='button' onClick={onClick} disabled={disabled} data-testid='perm-btn'>
      {children}
    </button>
  ),
  ClassStatusBadge: () => <div data-testid='class-status-badge'>CSB</div>,
}));

const emptyClassNow = {} as unknown as ClassNowStatus;

function makeDeps(overrides: Partial<RemoteNotifyDeps> = {}): RemoteNotifyDeps {
  const base: RemoteNotifyDeps = {
    mode: 'broadcast',
    setMode: vi.fn(),
    isSending: false,
    lastResult: null,
    form: { ...DEFAULT_NOTIFY_FORM },
    setForm: vi.fn(),
    scoreForm: { ...DEFAULT_SCORE_FORM },
    setScoreForm: vi.fn(),
    forceSend: false,
    setForceSend: vi.fn(),
    previewConfirm: null,
    setPreviewConfirm: vi.fn(),
    classNow: emptyClassNow,
    handleSubmit: vi.fn(),
    handleReset: vi.fn(),
    performSend: vi.fn(),
    handleUsePreset: vi.fn(),
    templates: [],
    templatesLoading: false,
    editingTemplate: null,
    setEditingTemplate: vi.fn(),
    templateForm: { ...DEFAULT_TEMPLATE_FORM },
    setTemplateForm: vi.fn(),
    showTemplateModal: false,
    openTemplateModal: vi.fn(),
    closeTemplateModal: vi.fn(),
    handleUseTemplate: vi.fn(),
    handleSaveTemplate: vi.fn(),
    handleDeleteTemplate: vi.fn(),
    scheduledNotifications: [],
    scheduledForceSend: false,
    setScheduledForceSend: vi.fn(),
    scheduledClassNow: emptyClassNow,
    editingScheduled: null,
    setEditingScheduled: vi.fn(),
    scheduledForm: { ...DEFAULT_SCHEDULED_FORM },
    setScheduledForm: vi.fn(),
    showScheduledModal: false,
    openScheduledModal: vi.fn(),
    closeScheduledModal: vi.fn(),
    handleUseCurrentFormForScheduled: vi.fn(),
    handleTriggerScheduled: vi.fn(),
    handleCancelScheduled: vi.fn(),
    handleDeleteScheduled: vi.fn(),
    handleSaveScheduled: vi.fn(),
    showHistory: false,
    closeHistory: vi.fn(),
    historyData: [],
    historyStats: null,
    historyPage: 1,
    setHistoryPage: vi.fn(),
    historyTotal: 0,
    historyFilter: '',
    setHistoryFilter: vi.fn(),
    isLoadingHistory: false,
    handleCleanHistory: vi.fn(),
    historyColumns: [] as ColumnType<any>[],
  };
  return { ...base, ...overrides };
}

const DEP_FIELDS = (c: HTMLElement) => c.textContent || '';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SendForm', () => {
  it('broadcast 默认渲染：通知内容/样式/语音(开+音量)/弹窗(开+自动关闭)/紧急(关)/预览/发送按钮', () => {
    const { container } = render(<SendForm deps={makeDeps()} />);
    const t = DEP_FIELDS(container);
    expect(screen.getByTestId('mode-selector')).toBeTruthy();
    expect(t).toContain('通知内容');
    expect(t).toContain('背景颜色');
    expect(t).toContain('文字颜色');
    expect(t).toContain('语音播报');
    expect(t).toContain('弹窗显示');
    expect(t).toContain('音量');
    expect(t).toContain('自动关闭');
    expect(t).toContain('紧急通知');
    expect(t).toContain('普通通知样式');
    expect(t).toContain('预览效果');
    expect(t).toContain('发送通知');
    expect(t).toContain('重置');
    expect(screen.getByTestId('class-status-badge')).toBeTruthy();
  });

  it('mode=device：渲染设备ID 输入框', () => {
    const { container } = render(<SendForm deps={makeDeps({ mode: 'device' })} />);
    expect(DEP_FIELDS(container)).toContain('设备ID');
    // 设备模式仍包含通知内容
    expect(DEP_FIELDS(container)).toContain('通知内容');
  });

  it('mode=test：隐藏通知内容/样式/预览，但语音/弹窗/紧急仍显示', () => {
    const { container } = render(<SendForm deps={makeDeps({ mode: 'test' })} />);
    const t = DEP_FIELDS(container);
    expect(t).not.toContain('通知内容');
    expect(t).not.toContain('背景颜色');
    expect(t).not.toContain('预览效果');
    expect(t).toContain('语音播报');
    expect(t).toContain('弹窗显示');
    expect(t).toContain('紧急通知');
  });

  it('mode=score_change：渲染积分表单全部字段，隐藏通知内容/样式/语音/弹窗/紧急', () => {
    const { container } = render(<SendForm deps={makeDeps({ mode: 'score_change' })} />);
    const t = DEP_FIELDS(container);
    expect(t).toContain('学生姓名');
    expect(t).toContain('积分变化');
    expect(t).toContain('变动原因');
    expect(t).toContain('课程名称');
    expect(t).toContain('指定设备');
    expect(t).not.toContain('通知内容');
    expect(t).not.toContain('背景颜色');
    expect(t).not.toContain('语音播报');
    expect(t).not.toContain('弹窗显示');
    expect(t).not.toContain('紧急通知');
  });

  it('form.speak=false：显示 VolumeX 文案且隐藏音量滑块', () => {
    const { container } = render(
      <SendForm
        deps={makeDeps({ mode: 'broadcast', form: { ...DEFAULT_NOTIFY_FORM, speak: false } })}
      />
    );
    const t = DEP_FIELDS(container);
    expect(t).not.toContain('音量');
    expect(t).toContain('弹窗显示');
  });

  it('form.popup=false：隐藏自动关闭滑块与预览区域', () => {
    const { container } = render(
      <SendForm
        deps={makeDeps({ mode: 'broadcast', form: { ...DEFAULT_NOTIFY_FORM, popup: false } })}
      />
    );
    const t = DEP_FIELDS(container);
    expect(t).not.toContain('自动关闭');
    expect(t).not.toContain('预览效果');
  });

  it('form.urgent=true：显示红色全屏文案', () => {
    const { container } = render(
      <SendForm
        deps={makeDeps({ mode: 'broadcast', form: { ...DEFAULT_NOTIFY_FORM, urgent: true } })}
      />
    );
    expect(DEP_FIELDS(container)).toContain('红色全屏弹窗，高优先级');
  });

  it('form.text 非空 + popup：预览区域显示文本', () => {
    const { container } = render(
      <SendForm
        deps={makeDeps({
          mode: 'broadcast',
          form: { ...DEFAULT_NOTIFY_FORM, popup: true, text: '上课了' },
        })}
      />
    );
    expect(DEP_FIELDS(container)).toContain('上课了');
  });

  it('lastResult.success=true：显示发送成功 + 主题', () => {
    const { container } = render(
      <SendForm
        deps={makeDeps({
          lastResult: { success: true, message: 'ok', topic: 't/class' },
        })}
      />
    );
    const t = DEP_FIELDS(container);
    expect(t).toContain('发送成功');
    expect(t).toContain('ok');
    expect(t).toContain('主题: t/class');
  });

  it('lastResult.success=false：显示发送失败且无主题行', () => {
    const { container } = render(
      <SendForm deps={makeDeps({ lastResult: { success: false, message: 'boom', topic: '' } })} />
    );
    const t = DEP_FIELDS(container);
    expect(t).toContain('发送失败');
    expect(t).toContain('boom');
    expect(t).not.toContain('主题:');
  });

  it('isSending=true：发送按钮显示发送中并 disabled', () => {
    render(<SendForm deps={makeDeps({ isSending: true })} />);
    const btn = screen.getByTestId('perm-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(DEP_FIELDS(btn)).toContain('发送中');
  });

  it('previewConfirm.open=true：渲染 PreviewConfirmModal', () => {
    const { container } = render(
      <SendForm
        deps={makeDeps({
          previewConfirm: {
            open: true,
            kind: 'broadcast',
            notifyData: {
              text: 'x',
              speak: true,
              popup: true,
              timeout_sec: 8,
              urgent: false,
              force_send: false,
            },
            preview: null,
            expanded: false,
          },
        })}
      />
    );
    expect(screen.getByTestId('preview-modal')).toBeTruthy();
    expect(DEP_FIELDS(container)).toContain('PREVIEW_MODAL');
  });

  it('交互：设备ID 输入触发 setForm', () => {
    const deps = makeDeps({ mode: 'device' });
    render(<SendForm deps={deps} />);
    const input = screen.getByPlaceholderText('输入电脑客户端ID（启动时显示）') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'DEV1' } });
    expect(deps.setForm).toHaveBeenCalled();
  });

  it('交互：通知内容 textarea 触发 setForm', () => {
    const deps = makeDeps();
    render(<SendForm deps={deps} />);
    const ta = screen.getByPlaceholderText('输入要发送的通知文本...') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'hi' } });
    expect(deps.setForm).toHaveBeenCalled();
  });

  it('交互：积分 +/- 与快捷按钮触发 setScoreForm', () => {
    const deps = makeDeps({ mode: 'score_change' });
    render(<SendForm deps={deps} />);
    const minus = screen.getByText('-');
    const plus = screen.getByText('+');
    const plus5 = screen.getByText('+5');
    fireEvent.click(minus);
    fireEvent.click(plus);
    fireEvent.click(plus5);
    expect(deps.setScoreForm).toHaveBeenCalledTimes(3);
  });

  it('交互：预设背景色按钮触发 setForm(bg_color)', () => {
    const deps = makeDeps();
    render(<SendForm deps={deps} />);
    const redBtn = screen.getAllByTitle('红色')[0];
    fireEvent.click(redBtn);
    expect(deps.setForm).toHaveBeenCalled();
  });

  it('交互：语音/弹窗/紧急 checkbox 触发 setForm', () => {
    const deps = makeDeps();
    const { container } = render(<SendForm deps={deps} />);
    // DOM 顺序：speak / popup / urgent 三个 checkbox（均为 sr-only peer 隐藏控件）
    const checks = container.querySelectorAll('input[type="checkbox"]');
    expect(checks.length).toBeGreaterThanOrEqual(3);
    fireEvent.click(checks[0] as HTMLInputElement);
    fireEvent.click(checks[1] as HTMLInputElement);
    fireEvent.click(checks[2] as HTMLInputElement);
    expect(deps.setForm).toHaveBeenCalledTimes(3);
  });

  it('交互：发送按钮触发 handleSubmit，重置按钮触发 handleReset', () => {
    const deps = makeDeps();
    render(<SendForm deps={deps} />);
    fireEvent.click(screen.getByTestId('perm-btn'));
    expect(deps.handleSubmit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('重置'));
    expect(deps.handleReset).toHaveBeenCalledTimes(1);
  });
});
