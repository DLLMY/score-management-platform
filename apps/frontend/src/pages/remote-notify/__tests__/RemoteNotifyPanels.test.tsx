// 远程通知 - 展示面板（HistoryPanel/TemplatesPanel/ScheduledPanel）与 columns 纯函数测试
// 继续 mock 共享 UI 为 stub，聚焦各面板条件分支覆盖。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HistoryPanel } from '../HistoryPanel';
import { TemplatesPanel } from '../TemplatesPanel';
import { ScheduledPanel } from '../ScheduledPanel';
import { PreviewConfirmModal } from '../PreviewConfirmModal';
import { buildHistoryColumns } from '../columns';
import { type RemoteNotifyDeps, type PreviewConfirmState, type NotifyPayload } from '../types';
import { type NotifyHistory } from '../../../services/api';

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
  Pagination: () => <div data-testid='pagination' />,
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
    form,
    templateForm,
    scheduledForm,
    setForm: vi.fn(),
    setTemplateForm: vi.fn(),
    setScheduledForm: vi.fn(),
    forceSend: false,
    setForceSend: vi.fn(),
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

describe('HistoryPanel 历史记录弹窗', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('showHistory=false 渲染 null', () => {
    const { container } = render(<HistoryPanel deps={makeDeps({ showHistory: false })} />);
    expect(container.firstChild).toBeNull();
  });

  it('showHistory=true 渲染统计/筛选/列表并触发操作', () => {
    const historyData: NotifyHistory[] = [
      {
        id: 1,
        urgent: true,
        text: 'hello',
        send_mode: 'broadcast',
        status: 'sent',
        created_at: '2026-01-01T00:00:00',
      } as NotifyHistory,
    ];
    const deps = makeDeps({
      showHistory: true,
      historyData,
      historyStats: { total_count: 10, today_count: 5, success_rate: 90, fail_count: 1 },
      historyColumns: buildHistoryColumns(),
      setHistoryPage: vi.fn(),
    });
    render(<HistoryPanel deps={deps} />);
    expect(screen.getByText('通知历史记录')).toBeTruthy();
    expect(screen.getByText('总发送量')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy(); // 总发送量值
    expect(screen.getByText('清理30天前记录')).toBeTruthy();
    // DataTable stub 渲染了行
    expect(screen.getByTestId('datatable')).toBeTruthy();
    // 清理按钮
    fireEvent.click(screen.getByText('清理30天前记录'));
    expect(deps.handleCleanHistory).toHaveBeenCalledTimes(1);
    // 改变筛选
    const select = document.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'sent' } });
    expect(deps.setHistoryFilter).toHaveBeenCalledWith('sent');
    expect(deps.setHistoryPage).toHaveBeenCalledWith(1);
  });
});

describe('TemplatesPanel 模板卡片', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('templates 为空显示占位', () => {
    render(<TemplatesPanel deps={makeDeps({ templates: [], templatesLoading: false })} />);
    expect(screen.getByText('暂无模板，点击新建按钮创建')).toBeTruthy();
  });

  it('templates 非空并打开编辑弹窗触发回调', () => {
    const deps = makeDeps({
      templates: [
        {
          id: 1,
          name: 't1',
          category: '教学',
          text: 'y',
          bg_color: '#000000',
          text_color: '#FF0000',
          font_size: 48,
          language: 'zh',
        },
      ],
      showTemplateModal: true,
      editingTemplate: null,
    });
    render(<TemplatesPanel deps={deps} />);
    expect(screen.getByText('t1')).toBeTruthy();
    expect(screen.getByText('新建模板')).toBeTruthy();
    expect(screen.getByText('模板名称')).toBeTruthy();
    // 使用模板
    fireEvent.click(screen.getByText('t1'));
    expect(deps.handleUseTemplate).toHaveBeenCalledTimes(1);
    // 保存
    fireEvent.click(screen.getByText('保存'));
    expect(deps.handleSaveTemplate).toHaveBeenCalledTimes(1);
    // 取消
    fireEvent.click(screen.getByText('取消'));
    expect(deps.closeTemplateModal).toHaveBeenCalledTimes(1);
  });
});

describe('ScheduledPanel 定时通知卡片', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scheduledNotifications 为空显示占位', () => {
    render(<ScheduledPanel deps={makeDeps({ scheduledNotifications: [] })} />);
    expect(screen.getByText('暂无定时通知')).toBeTruthy();
  });

  it('scheduledNotifications 非空并打开 weekly 编辑弹窗触发回调', () => {
    const deps = makeDeps({
      scheduledNotifications: [
        {
          id: 1,
          status: 'pending',
          text: 'a',
          next_send_at: '2026-01-01T00:00:00',
          repeat_type: 'daily',
        },
        {
          id: 2,
          status: 'sent',
          text: 'b',
          scheduled_at: '2026-01-01T00:00:00',
          repeat_type: 'weekly',
        },
      ],
      showScheduledModal: true,
      editingScheduled: null,
      scheduledForm: {
        text: '',
        scheduled_at: '',
        repeat_type: 'weekly',
        repeat_interval: 1,
        repeat_end_at: '',
        repeat_day_of_week: [],
        send_mode: 'broadcast',
        device_id: '',
        speak: false,
        popup: false,
        urgent: false,
      },
    });
    render(<ScheduledPanel deps={deps} />);
    expect(screen.getByText('a')).toBeTruthy();
    expect(screen.getByText('b')).toBeTruthy();
    expect(screen.getByText('新建定时通知')).toBeTruthy();
    // 立即发送（两个通知各一个）
    const triggers = screen.getAllByTitle('立即发送');
    expect(triggers).toHaveLength(2);
    fireEvent.click(triggers[0]);
    expect(deps.handleTriggerScheduled).toHaveBeenCalledWith(1);
    // 取消 pending
    fireEvent.click(screen.getByTitle('取消'));
    expect(deps.handleCancelScheduled).toHaveBeenCalledWith(1);
    // 删除 sent（第 2 项）
    const dels = screen.getAllByTitle('删除');
    expect(dels).toHaveLength(2);
    fireEvent.click(dels[1]);
    expect(deps.handleDeleteScheduled).toHaveBeenCalledWith(2);
    // 星期选择（weekly 区块）
    fireEvent.click(screen.getByText('周一'));
    expect(deps.setScheduledForm).toHaveBeenCalled();
    // 保存 / 取消弹窗
    fireEvent.click(screen.getByText('保存'));
    expect(deps.handleSaveScheduled).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('取消'));
    expect(deps.closeScheduledModal).toHaveBeenCalledTimes(1);
  });
});

describe('buildHistoryColumns 纯函数', () => {
  it('返回 4 列且每个 render 闭包可调用', () => {
    const cols = buildHistoryColumns();
    expect(cols).toHaveLength(4);
    const item = {
      id: 1,
      urgent: true,
      text: 'x',
      send_mode: 'device',
      status: 'failed',
      created_at: '2026-01-01T00:00:00',
    } as NotifyHistory;
    // 逐列调用 render（覆盖各分支：urgent、send_mode device/broadcast、status 四态、created_at 格式化）
    cols.forEach((c) => {
      const node = c.render
        ? (c.render as unknown as (v: unknown, it: NotifyHistory) => unknown)(
            item[c.dataIndex as keyof NotifyHistory],
            item
          )
        : null;
      expect(node).toBeTruthy();
    });
    // 额外覆盖 broadcast / pending / 未知状态分支
    const bItem = { ...item, send_mode: 'broadcast', status: 'pending' } as NotifyHistory;
    expect(
      (cols[1].render as unknown as (v: unknown, it: NotifyHistory) => unknown)(
        bItem.send_mode,
        bItem
      )
    ).toBeTruthy();
    expect(
      (cols[2].render as unknown as (v: unknown, it: NotifyHistory) => unknown)(bItem.status, bItem)
    ).toBeTruthy();
    const uItem = { ...item, status: 'weird' } as NotifyHistory;
    expect(
      (cols[2].render as unknown as (v: unknown, it: NotifyHistory) => unknown)(uItem.status, uItem)
    ).toBeTruthy();
  });
});

describe('PreviewConfirmModal 预览确认弹窗', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseProps = (over: Partial<PreviewConfirmState> = {}) => ({
    previewConfirm: {
      open: true,
      kind: 'broadcast' as const,
      notifyData: { text: 'hi' } as NotifyPayload,
      deviceId: undefined,
      preview: null,
      expanded: false,
      ...over,
    },
    isSending: false,
    setPreviewConfirm: vi.fn(),
    performSend: vi.fn(),
  });

  it('preview=null 显示不可用提示且确认发送仍可用', () => {
    const props = baseProps();
    render(<PreviewConfirmModal {...props} />);
    expect(screen.getByText('（在线预览暂不可用，仍可发送）')).toBeTruthy();
    // preview 缺失时确认发送按钮仍调用 performSend
    fireEvent.click(screen.getByText('确认发送'));
    expect(props.performSend).toHaveBeenCalledWith({ text: 'hi' }, 'broadcast', undefined);
  });

  it('preview 存在且有在线名单，展开/收起切换', () => {
    const setPreviewConfirm = vi.fn();
    render(
      <PreviewConfirmModal
        {...baseProps({
          preview: {
            total_devices: 3,
            online_count: 2,
            cutoff_minutes: 5,
            online_sample: [
              { device_id: 'd1', class_name: 'c1', last_heartbeat: '2026-01-01T00:00:00' },
              { device_id: 'd2', class_name: 'c2', last_heartbeat: '2026-01-01T00:00:00' },
            ],
          },
          expanded: false,
        })}
        setPreviewConfirm={setPreviewConfirm}
      />
    );
    expect(screen.getByText('展开名单')).toBeTruthy();
    fireEvent.click(screen.getByText('展开名单'));
    expect(setPreviewConfirm).toHaveBeenCalledWith(expect.any(Function));
  });

  it('取消按钮与遮罩关闭', () => {
    const setPreviewConfirm = vi.fn();
    const { container } = render(
      <PreviewConfirmModal {...baseProps()} setPreviewConfirm={setPreviewConfirm} />
    );
    fireEvent.click(screen.getByText('取消'));
    expect(setPreviewConfirm).toHaveBeenCalledWith(expect.any(Function));
    // 遮罩（最外层 div）点击关闭
    const overlay = container.querySelector('.fixed') as HTMLElement;
    fireEvent.click(overlay);
    expect(setPreviewConfirm).toHaveBeenCalledWith(expect.any(Function));
  });
});
