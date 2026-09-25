// 远程通知 - 组合根视图（RemoteNotifyView）渲染测试
// 通过 mock 共享 UI 组件（PermissionButton/ClassStatusBadge/Pagination/DataTable）为 stub，
// 避免 PermissionProvider 依赖与重型子组件，聚焦视图装配与各面板主路径/分支覆盖。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import RemoteNotifyView from '../RemoteNotifyView';
import { type RemoteNotifyDeps } from '../types';

afterEach(cleanup);

vi.mock('../../../components', () => ({
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
  Pagination: ({
    currentPage,
    totalPages,
    onPageChange,
  }: {
    currentPage?: number;
    totalPages?: number;
    onPageChange?: (p: number) => void;
  }) => (
    <div data-testid='pagination'>
      <button type='button' onClick={() => onPageChange?.((currentPage ?? 1) + 1)}>
        next
      </button>
      <span>{totalPages}</span>
    </div>
  ),
  DataTable: ({
    dataSource,
    loading,
    empty,
  }: {
    dataSource?: unknown[];
    loading?: boolean;
    empty?: { title?: string };
  }) => (
    <div data-testid='datatable'>
      {loading ? 'loading' : null}
      {dataSource?.length
        ? dataSource.map((_: unknown, i: number) => <span key={i} data-testid='row' />)
        : null}
      {!dataSource?.length && !loading && empty ? empty.title : null}
    </div>
  ),
}));

function makeViewDeps(overrides: Record<string, unknown> = {}): RemoteNotifyDeps {
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
    setForm: vi.fn(),
    setScoreForm: vi.fn(),
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

function renderView(deps: RemoteNotifyDeps, extra: Record<string, unknown> = {}) {
  return render(
    <RemoteNotifyView
      deps={deps}
      draftAvailable={false}
      handleRestoreDraft={vi.fn()}
      handleDiscardDraft={vi.fn()}
      loadError={false}
      openHistory={vi.fn()}
      mqttConnected={null}
      scheduled={{ total: 0 }}
      scheduledPage={1}
      setScheduledPage={vi.fn()}
      scheduledPerPage={10}
      {...(extra as any)}
    />
  );
}

describe('RemoteNotifyView 组合根视图', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('broadcast 默认渲染所有面板主路径', () => {
    renderView(makeViewDeps());
    expect(screen.getByText('远程通知')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '快捷预设' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '我的模板' })).toBeTruthy();
    expect(screen.getByText('暂无模板，点击新建按钮创建')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '定时通知' })).toBeTruthy();
    expect(screen.getByText('暂无定时通知')).toBeTruthy();
    // ModeSelector 四模式按钮
    expect(screen.getByText('广播通知')).toBeTruthy();
    expect(screen.getByText('指定设备')).toBeTruthy();
    expect(screen.getByText('测试通知')).toBeTruthy();
    expect(screen.getByText('积分变化')).toBeTruthy();
    // SendForm 发送按钮
    expect(screen.getByRole('button', { name: '发送通知' })).toBeTruthy();
    // MQTT 检查中（mqttConnected=null）
    expect(screen.getByText('检查中...')).toBeTruthy();
    // 使用说明
    expect(screen.getByRole('heading', { name: '使用说明' })).toBeTruthy();
  });

  it('device 模式显示设备ID输入框', () => {
    renderView(makeViewDeps({ mode: 'device' }));
    expect(screen.getByText('设备ID')).toBeTruthy();
  });

  it('test 模式不渲染通知内容输入', () => {
    renderView(makeViewDeps({ mode: 'test' }));
    expect(screen.queryByPlaceholderText('输入要发送的通知文本...')).toBeNull();
  });

  it('score_change 模式渲染积分表单且不渲染设备ID输入', () => {
    renderView(makeViewDeps({ mode: 'score_change' }));
    expect(screen.getByText('学生姓名 *')).toBeTruthy();
    expect(screen.getByText('积分变化 *')).toBeTruthy();
    expect(screen.queryByText('设备ID')).toBeNull();
  });

  it('draftAvailable 显示草稿恢复条并触发回调', () => {
    const handleRestoreDraft = vi.fn();
    const handleDiscardDraft = vi.fn();
    renderView(makeViewDeps(), {
      draftAvailable: true,
      handleRestoreDraft,
      handleDiscardDraft,
    });
    expect(screen.getByText('检测到上次未提交的内容，是否恢复？')).toBeTruthy();
    fireEvent.click(screen.getByText('恢复'));
    expect(handleRestoreDraft).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('放弃'));
    expect(handleDiscardDraft).toHaveBeenCalledTimes(1);
  });

  it('loadError 显示数据加载失败提示', () => {
    renderView(makeViewDeps(), { loadError: true });
    expect(
      screen.getByText(/部分数据加载失败（模板\/定时通知\/历史记录），当前列表可能不完整/)
    ).toBeTruthy();
  });

  it('mqttConnected 三态文案', () => {
    const { rerender } = renderView(makeViewDeps(), { mqttConnected: true });
    expect(screen.getByText('MQTT已连接')).toBeTruthy();
    rerender(
      <RemoteNotifyView
        deps={makeViewDeps()}
        draftAvailable={false}
        handleRestoreDraft={vi.fn()}
        handleDiscardDraft={vi.fn()}
        loadError={false}
        openHistory={vi.fn()}
        mqttConnected={false}
        scheduled={{ total: 0 }}
        scheduledPage={1}
        setScheduledPage={vi.fn()}
        scheduledPerPage={10}
      />
    );
    expect(screen.getByText('MQTT未连接')).toBeTruthy();
  });

  it('scheduled.total>0 渲染分页并触发翻页', () => {
    const setScheduledPage = vi.fn();
    renderView(makeViewDeps(), {
      scheduled: { total: 25 },
      setScheduledPage,
    });
    const pagination = screen.getByTestId('pagination');
    expect(pagination).toBeTruthy();
    fireEvent.click(pagination.querySelector('button') as HTMLElement);
    expect(setScheduledPage).toHaveBeenCalledWith(2);
  });

  it('previewConfirm.open 渲染预览确认弹窗并确认发送', () => {
    const deps = makeViewDeps({
      previewConfirm: {
        open: true,
        kind: 'broadcast',
        notifyData: { text: 'hi' },
        deviceId: undefined,
        preview: {
          total_devices: 2,
          online_count: 1,
          cutoff_minutes: 5,
          online_sample: [
            { device_id: 'd1', class_name: 'c1', last_heartbeat: '2026-01-01T00:00:00' },
          ],
        },
        expanded: true,
      },
    });
    renderView(deps);
    expect(screen.getByText('确认发送通知')).toBeTruthy();
    expect(screen.getByText('全部设备（广播）')).toBeTruthy();
    expect(screen.getByText('d1')).toBeTruthy(); // expanded 名单渲染
    fireEvent.click(screen.getByText('确认发送'));
    expect(deps.performSend).toHaveBeenCalledWith({ text: 'hi' }, 'broadcast', undefined);
    expect(deps.setPreviewConfirm).toHaveBeenCalledWith(null);
  });
});
