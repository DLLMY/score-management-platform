import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScheduledPanel } from './ScheduledPanel';
import type { RemoteNotifyDeps } from './types';

vi.mock('../../components', () => ({
  PermissionButton: ({
    children,
    onClick,
    title,
    disabled,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    title?: string;
    disabled?: boolean;
  }) => (
    <button title={title} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  ClassStatusBadge: () => <div data-testid='class-status-badge' />,
}));

type Item = {
  id: number;
  text: string;
  status: 'sent' | 'pending' | 'failed' | 'other';
  next_send_at?: string;
  scheduled_at?: string;
  repeat_type?: string;
};

function makeItem(overrides: Partial<Item> = {}): Item {
  return { id: 1, text: '上课提醒', status: 'sent', ...overrides };
}

function makeDeps(overrides: Record<string, unknown> = {}): RemoteNotifyDeps {
  const base = {
    scheduledNotifications: [] as Item[],
    scheduledForceSend: false,
    setScheduledForceSend: vi.fn(),
    scheduledClassNow: null,
    editingScheduled: false,
    scheduledForm: {
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
    },
    setScheduledForm: vi.fn(),
    showScheduledModal: false,
    closeScheduledModal: vi.fn(),
    handleUseCurrentFormForScheduled: vi.fn(),
    handleTriggerScheduled: vi.fn(),
    handleCancelScheduled: vi.fn(),
    handleDeleteScheduled: vi.fn(),
    handleSaveScheduled: vi.fn(),
  };
  return { ...base, ...overrides } as unknown as RemoteNotifyDeps;
}

function renderPanel(deps: RemoteNotifyDeps) {
  return render(<ScheduledPanel deps={deps} />);
}

describe('ScheduledPanel 渲染与分支覆盖 B51', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('无定时通知时显示空态', () => {
    renderPanel(makeDeps());
    expect(screen.getByText('暂无定时通知')).toBeInTheDocument();
    expect(screen.getByTestId('class-status-badge')).toBeInTheDocument();
  });

  it('渲染通知列表项（各状态圆点分支）', () => {
    const items = [
      makeItem({ id: 1, status: 'sent' }),
      makeItem({ id: 2, status: 'pending' }),
      makeItem({ id: 3, status: 'failed' }),
      makeItem({ id: 4, status: 'weird' as Item['status'] }),
    ];
    renderPanel(makeDeps({ scheduledNotifications: items }));
    expect(screen.getAllByText('上课提醒')).toHaveLength(4);
  });

  it('时间字段：有 next_send_at 显示日期；均无显示 --', () => {
    const withDate = makeItem({ id: 1, next_send_at: '2026-01-01T08:00:00Z' });
    const noDate = makeItem({ id: 2, status: 'pending' });
    renderPanel(makeDeps({ scheduledNotifications: [withDate, noDate] }));
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(1);
  });

  it('repeat_type 非 once 显示间隔/结束时间；标签 daily/weekly/monthly', () => {
    const daily = makeDeps({
      showScheduledModal: true,
      scheduledNotifications: [makeItem()],
      scheduledForm: {
        text: '',
        scheduled_at: '',
        repeat_type: 'daily',
        repeat_interval: 2,
        repeat_end_at: '',
        repeat_day_of_week: [],
        send_mode: 'broadcast',
        device_id: '',
        speak: false,
        popup: false,
        urgent: false,
      },
    });
    renderPanel(daily);
    expect(screen.getByText('每天')).toBeInTheDocument();
    expect(screen.getByText('重复间隔')).toBeInTheDocument();
    expect(screen.getByText('结束时间（可选）')).toBeInTheDocument();
  });

  it('repeat_type=once 不显示间隔/结束时间', () => {
    renderPanel(makeDeps({ scheduledForm: { ...makeDeps().scheduledForm, repeat_type: 'once' } }));
    expect(screen.queryByText('重复间隔')).toBeNull();
  });

  it('repeat_type=weekly 渲染星期按钮并可点击切换', () => {
    const deps = makeDeps({
      showScheduledModal: true,
      scheduledNotifications: [makeItem()],
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
    renderPanel(deps);
    expect(screen.getByText('每周')).toBeInTheDocument();
    const mon = screen.getByText('周一');
    fireEvent.click(mon);
    expect(deps.setScheduledForm).toHaveBeenCalled();
  });

  it('send_mode=device 显示设备ID；broadcast 不显示', () => {
    const device = makeDeps({
      showScheduledModal: true,
      scheduledNotifications: [makeItem()],
      scheduledForm: {
        text: '',
        scheduled_at: '',
        repeat_type: 'once',
        repeat_interval: 1,
        repeat_end_at: '',
        repeat_day_of_week: [],
        send_mode: 'device',
        device_id: 'dev-1',
        speak: false,
        popup: false,
        urgent: false,
      },
    });
    renderPanel(device);
    expect(screen.getByText('设备ID')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('输入设备ID')).toBeInTheDocument();
  });

  it('复选框 speak/popup/urgent 点击派发 setScheduledForm', () => {
    const deps = makeDeps({
      showScheduledModal: true,
      scheduledForm: {
        text: '',
        scheduled_at: '',
        repeat_type: 'once',
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
    renderPanel(deps);
    fireEvent.click(screen.getByLabelText('语音播报'));
    fireEvent.click(screen.getByLabelText('弹窗显示'));
    fireEvent.click(screen.getByLabelText('紧急通知'));
    expect(deps.setScheduledForm).toHaveBeenCalledTimes(3);
  });

  it('新建按钮触发 handleUseCurrentFormForScheduled', () => {
    const deps = makeDeps({ scheduledNotifications: [makeItem()] });
    renderPanel(deps);
    fireEvent.click(screen.getByText('新建'));
    expect(deps.handleUseCurrentFormForScheduled).toHaveBeenCalledTimes(1);
  });

  it('通知项操作按钮：立即发送/删除始终可用；取消仅 pending', () => {
    const pending = makeDeps({ scheduledNotifications: [makeItem({ id: 9, status: 'pending' })] });
    const { unmount } = renderPanel(pending);
    fireEvent.click(screen.getByTitle('立即发送'));
    fireEvent.click(screen.getByTitle('取消'));
    fireEvent.click(screen.getByTitle('删除'));
    expect(pending.handleTriggerScheduled).toHaveBeenCalledWith(9);
    expect(pending.handleCancelScheduled).toHaveBeenCalledWith(9);
    expect(pending.handleDeleteScheduled).toHaveBeenCalledWith(9);
    unmount();

    const failed = makeDeps({ scheduledNotifications: [makeItem({ id: 8, status: 'failed' })] });
    renderPanel(failed);
    expect(screen.queryByTitle('取消')).toBeNull();
    fireEvent.click(screen.getByTitle('删除'));
    expect(failed.handleDeleteScheduled).toHaveBeenCalledWith(8);
  });

  it('编辑弹窗：editingScheduled 决定标题，保存/取消派发', () => {
    const deps = makeDeps({
      showScheduledModal: true,
      editingScheduled: true,
      scheduledForm: {
        text: 'hi',
        scheduled_at: '',
        repeat_type: 'once',
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
    renderPanel(deps);
    expect(screen.getByText('编辑定时通知')).toBeInTheDocument();
    fireEvent.click(screen.getByText('保存'));
    expect(deps.handleSaveScheduled).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('取消'));
    expect(deps.closeScheduledModal).toHaveBeenCalledTimes(1);
  });

  it('新建弹窗标题为「新建定时通知」', () => {
    const deps = makeDeps({
      showScheduledModal: true,
      editingScheduled: false,
      scheduledForm: {
        text: '',
        scheduled_at: '',
        repeat_type: 'once',
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
    renderPanel(deps);
    expect(screen.getByText('新建定时通知')).toBeInTheDocument();
  });
});
