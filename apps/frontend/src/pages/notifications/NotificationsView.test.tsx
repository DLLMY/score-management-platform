import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { NotificationsViewProps } from './types';
import type { AdminNotification } from '../../services/api';
import NotificationsView from './NotificationsView';

// 全局 barrel 组件桩：Modal 在 isOpen 时渲染 children + 关闭按钮，便于触发 onClose 分支
vi.mock('../../components', () => ({
  Card: ({ title, children }: { title?: string; children?: React.ReactNode }) => (
    <div data-testid='card'>
      {title != null && <div>{title}</div>}
      {children}
    </div>
  ),
  Button: ({
    children,
    disabled,
    onClick,
    type,
  }: {
    children?: React.ReactNode;
    disabled?: boolean;
    onClick?: () => void;
    type?: 'button' | 'submit';
  }) => (
    <button type={type || 'button'} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  Modal: ({
    isOpen,
    onClose,
    title,
    children,
  }: {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children?: React.ReactNode;
  }) =>
    isOpen ? (
      <div data-testid='modal' role='dialog' aria-label={title}>
        <button onClick={onClose}>modal-close</button>
        {children}
      </div>
    ) : null,
  PermissionButton: ({
    children,
    onClick,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button onClick={onClick} data-permission='notification.send'>
      {children}
    </button>
  ),
}));

const makeNotification = (over: Partial<AdminNotification> = {}): AdminNotification => ({
  id: 1,
  title: '测试通知',
  message: '测试内容',
  type: 'info',
  priority: 'medium',
  is_read: false,
  created_at: '2026-09-29T10:00:00Z',
  ...over,
});

type ListResult = NotificationsViewProps['list'];

const baseList = (over: Partial<AdminNotification>[] = []) =>
  ({
    items: over,
    total: over.length,
    loading: false,
  } as unknown as ListResult);

const makeProps = (over: Partial<NotificationsViewProps> = {}): NotificationsViewProps => ({
  list: baseList([makeNotification()]),
  loadNotifications: vi.fn(),
  page: 1,
  setPage: vi.fn(),
  totalPages: 1,
  filterStatus: '',
  filterType: '',
  filterPriority: '',
  handleFilterChange: vi.fn(() => () => undefined),
  handleMarkRead: vi.fn(),
  handleMarkAllRead: vi.fn(),
  handleDelete: vi.fn(),
  showSendModal: false,
  setShowSendModal: vi.fn(),
  sendForm: { title: '', message: '', type: 'info', priority: 'medium' },
  setSendForm: vi.fn(),
  handleFormChange: vi.fn(() => () => undefined),
  handleSendNotification: vi.fn(),
  sending: false,
  unreadCount: 0,
  getTypeColor: (t: string) => `type-${t}`,
  getTypeLabel: (t: string) => `label-${t}`,
  getTypeIcon: (t: string) => <span data-testid='type-icon'>{t}</span>,
  getPriorityColor: (p: string) => `prio-${p}`,
  getPriorityLabel: (p: string) => `plabel-${p}`,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NotificationsView', () => {
  it('渲染主标题与副标题', () => {
    render(<NotificationsView {...makeProps()} />);
    expect(screen.getByText('通知中心')).toBeInTheDocument();
    expect(screen.getByText('查看和管理系统通知')).toBeInTheDocument();
  });

  it('unreadCount > 0 显示「全部已读」；=0 不显示', () => {
    const { rerender } = render(<NotificationsView {...makeProps({ unreadCount: 3 })} />);
    expect(screen.getByText('全部已读')).toBeInTheDocument();
    rerender(<NotificationsView {...makeProps({ unreadCount: 0 })} />);
    expect(screen.queryByText('全部已读')).toBeNull();
  });

  it('加载态显示「加载中...」', () => {
    render(<NotificationsView {...makeProps({ list: baseList([]) })} />);
    // 先设置 loading
    const loadingList = { items: [], total: 0, loading: true } as unknown as ListResult;
    const { rerender } = render(<NotificationsView {...makeProps({ list: loadingList })} />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
    rerender(<NotificationsView {...makeProps({ list: baseList([]) })} />);
    expect(screen.queryByText('加载中...')).toBeNull();
  });

  it('空态（非加载、items 为空）显示「暂无通知」+ 引导文案', () => {
    render(<NotificationsView {...makeProps({ list: baseList([]) })} />);
    expect(screen.getByText('暂无通知')).toBeInTheDocument();
    expect(screen.getByText('点击右上角「发送通知」给师生下发消息')).toBeInTheDocument();
  });

  it('渲染通知列表 item：标题/内容/图标/优先级标签/删除按钮', () => {
    const item = makeNotification({
      id: 7,
      title: '作业提醒',
      message: '请及时批改',
      type: 'warning',
      priority: 'high',
      is_read: true,
    });
    render(<NotificationsView {...makeProps({ list: baseList([item]) })} />);
    expect(screen.getByText('作业提醒')).toBeInTheDocument();
    expect(screen.getByText('请及时批改')).toBeInTheDocument();
    expect(screen.getAllByTestId('type-icon')[0]).toHaveTextContent('warning');
    expect(screen.getByText('label-warning')).toBeInTheDocument();
    expect(screen.getByText('plabel-high')).toBeInTheDocument();
    // 已读：无「标为已读」按钮
    expect(screen.queryByText('标为已读')).toBeNull();
    expect(screen.getByText('删除')).toBeInTheDocument();
  });

  it('未读 item 显示「标为已读」按钮 + 未读圆点', () => {
    const item = makeNotification({ id: 9, is_read: false });
    render(<NotificationsView {...makeProps({ list: baseList([item]) })} />);
    expect(screen.getByText('标为已读')).toBeInTheDocument();
  });

  it('type 三元四分支（success/warning/error/info 默认）', () => {
    const items = [
      makeNotification({ id: 1, type: 'success' }),
      makeNotification({ id: 2, type: 'warning' }),
      makeNotification({ id: 3, type: 'error' }),
      makeNotification({ id: 4, type: 'info' }),
    ];
    render(<NotificationsView {...makeProps({ list: baseList(items) })} />);
    expect(screen.getAllByTestId('type-icon')).toHaveLength(4);
  });

  it('read_at 存在时显示「已读于 ...」', () => {
    const item = makeNotification({
      id: 5,
      is_read: true,
      read_at: '2026-09-29T11:00:00Z',
    });
    render(<NotificationsView {...makeProps({ list: baseList([item]) })} />);
    expect(screen.getByText(/已读于/)).toBeInTheDocument();
  });

  it('分页：totalPages>1 显示页码 + 上一页/下一页', () => {
    const item = makeNotification();
    render(
      <NotificationsView {...makeProps({ list: baseList([item]), totalPages: 3, page: 2 })} />
    );
    expect(screen.getByText('共 1 条记录')).toBeInTheDocument();
    expect(screen.getByText('第 2 页 / 共 3 页')).toBeInTheDocument();
    expect(screen.getByText('上一页')).toBeInTheDocument();
    expect(screen.getByText('下一页')).toBeInTheDocument();
  });

  it('分页边界：第1页上一页 disabled；末页下一页 disabled', () => {
    const item = makeNotification();
    const { rerender } = render(
      <NotificationsView {...makeProps({ list: baseList([item]), totalPages: 3, page: 1 })} />
    );
    expect(screen.getByText('上一页')).toBeDisabled();
    expect(screen.getByText('下一页')).not.toBeDisabled();
    rerender(
      <NotificationsView {...makeProps({ list: baseList([item]), totalPages: 3, page: 3 })} />
    );
    expect(screen.getByText('下一页')).toBeDisabled();
    expect(screen.getByText('上一页')).not.toBeDisabled();
  });

  it('点击上一页/下一页触发 setPage', () => {
    const setPage = vi.fn();
    const item = makeNotification();
    render(
      <NotificationsView
        {...makeProps({ list: baseList([item]), totalPages: 3, page: 2, setPage })}
      />
    );
    fireEvent.click(screen.getByText('上一页'));
    expect(setPage).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByText('下一页'));
    expect(setPage).toHaveBeenCalledWith(3);
  });

  it('筛选 select 变更触发 handleFilterChange 对应字段', () => {
    const handleFilterChange = vi.fn(() => () => undefined);
    render(<NotificationsView {...makeProps({ handleFilterChange })} />);
    const statusSelect = screen.getByDisplayValue('全部状态') as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: 'true' } });
    expect(handleFilterChange).toHaveBeenCalledWith('status');
    const typeSelect = screen.getByDisplayValue('全部类型') as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: 'warning' } });
    expect(handleFilterChange).toHaveBeenCalledWith('type');
    const prioSelect = screen.getByDisplayValue('全部优先级') as HTMLSelectElement;
    fireEvent.change(prioSelect, { target: { value: 'high' } });
    expect(handleFilterChange).toHaveBeenCalledWith('priority');
  });

  it('刷新按钮：loading 时图标 animate-spin + 点击触发 loadNotifications', () => {
    const loadNotifications = vi.fn();
    const { rerender } = render(
      <NotificationsView
        {...makeProps({
          list: { items: [], total: 0, loading: true } as unknown as ListResult,
          loadNotifications,
        })}
      />
    );
    const refreshBtn = screen.getByText('刷新').closest('button')!;
    expect(refreshBtn.querySelector('.animate-spin')).not.toBeNull();
    rerender(<NotificationsView {...makeProps({ loadNotifications })} />);
    fireEvent.click(screen.getByText('刷新'));
    expect(loadNotifications).toHaveBeenCalled();
  });

  it('点击「全部已读」触发 handleMarkAllRead', () => {
    const handleMarkAllRead = vi.fn();
    render(<NotificationsView {...makeProps({ unreadCount: 2, handleMarkAllRead })} />);
    fireEvent.click(screen.getByText('全部已读'));
    expect(handleMarkAllRead).toHaveBeenCalled();
  });

  it('点击「标为已读」/「删除」触发对应 handler', () => {
    const handleMarkRead = vi.fn();
    const handleDelete = vi.fn();
    const item = makeNotification({ id: 11, is_read: false });
    render(
      <NotificationsView {...makeProps({ list: baseList([item]), handleMarkRead, handleDelete })} />
    );
    fireEvent.click(screen.getByText('标为已读'));
    expect(handleMarkRead).toHaveBeenCalledWith(11);
    fireEvent.click(screen.getByText('删除'));
    expect(handleDelete).toHaveBeenCalledWith(11);
  });

  it('发送模态：showSendModal=true 渲染表单；取消触发 setShowSendModal(false)+setSendForm', () => {
    const setShowSendModal = vi.fn();
    const setSendForm = vi.fn();
    render(
      <NotificationsView {...makeProps({ showSendModal: true, setShowSendModal, setSendForm })} />
    );
    const modal = screen.getByTestId('modal');
    expect(within(modal).getByText('发送通知')).toBeInTheDocument(); // Modal 标题
    expect(within(modal).getByPlaceholderText('请输入通知标题')).toBeInTheDocument();
    fireEvent.click(screen.getByText('取消'));
    expect(setShowSendModal).toHaveBeenCalledWith(false);
    expect(setSendForm).toHaveBeenCalledWith({
      title: '',
      message: '',
      type: 'info',
      priority: 'medium',
    });
  });

  it('发送模态：onClose（X）触发 setShowSendModal(false)+setSendForm', () => {
    const setShowSendModal = vi.fn();
    const setSendForm = vi.fn();
    render(
      <NotificationsView {...makeProps({ showSendModal: true, setShowSendModal, setSendForm })} />
    );
    fireEvent.click(screen.getByText('modal-close'));
    expect(setShowSendModal).toHaveBeenCalledWith(false);
    expect(setSendForm).toHaveBeenCalledWith({
      title: '',
      message: '',
      type: 'info',
      priority: 'medium',
    });
  });

  it('发送表单字段 change 触发 handleFormChange', () => {
    const handleFormChange = vi.fn(() => () => undefined);
    render(<NotificationsView {...makeProps({ showSendModal: true, handleFormChange })} />);
    const titleInput = screen.getByPlaceholderText('请输入通知标题') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: '紧急通知' } });
    expect(handleFormChange).toHaveBeenCalledWith('title');
    const typeSelect = screen.getByDisplayValue('信息') as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: 'error' } });
    expect(handleFormChange).toHaveBeenCalledWith('type');
    const prioSelect = screen.getByDisplayValue('中优先级') as HTMLSelectElement;
    fireEvent.change(prioSelect, { target: { value: 'high' } });
    expect(handleFormChange).toHaveBeenCalledWith('priority');
    const textarea = screen.getByPlaceholderText('请输入通知内容') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '内容' } });
    expect(handleFormChange).toHaveBeenCalledWith('message');
  });

  it('发送表单 submit 触发 handleSendNotification；sending 时按钮 disabled + 文案「发送中...」', () => {
    const handleSendNotification = vi.fn();
    const { rerender } = render(
      <NotificationsView
        {...makeProps({ showSendModal: true, handleSendNotification, sending: false })}
      />
    );
    const form = screen.getByTestId('modal').querySelector('form')!;
    fireEvent.submit(form);
    expect(handleSendNotification).toHaveBeenCalled();
    rerender(
      <NotificationsView
        {...makeProps({ showSendModal: true, handleSendNotification, sending: true })}
      />
    );
    expect(screen.getByText('发送中...')).toBeInTheDocument();
  });
});
