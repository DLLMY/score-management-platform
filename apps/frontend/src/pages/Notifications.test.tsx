/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ChangeEvent } from 'react';
import { MemoryRouter } from 'react-router-dom';
import Notifications from './Notifications';
import api from '../services/api';

vi.mock('../services/api', () => {
  const adminNotifications = {
    getAll: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
  };
  return {
    default: { adminNotifications },
    adminNotifications,
    AdminNotification: class {} as any,
  };
});

vi.mock('../utils/logger', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('../hooks', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  const { useState, useEffect } = React;
  const useStableToast = () => ({ showToast: vi.fn() });
  const useListFetch = (opts: any) => {
    const [state, setState] = useState<{ items: any[]; total: number }>({ items: [], total: 0 });
    useEffect(() => {
      let alive = true;
      Promise.resolve(opts.fetcher(opts.params))
        .then((r: any) => {
          if (alive) setState({ items: r?.items ?? [], total: r?.total ?? 0 });
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const refetch = vi.fn(async () => {
      const r = await opts.fetcher(opts.params);
      setState({ items: r?.items ?? [], total: r?.total ?? 0 });
    });
    const mutate = vi.fn((patch: any) => setState((prev: any) => ({ ...prev, ...patch })));
    return {
      ...state,
      loading: false,
      error: null,
      refetch,
      mutate,
      setItems: vi.fn(),
      setTotal: vi.fn(),
    };
  };
  return { useStableToast, useListFetch };
});

const confirmFn = vi.fn(async () => true);
vi.mock('../components', () => ({ useConfirm: () => confirmFn }));

vi.mock('./notifications/NotificationsView', () => ({
  default: vi.fn((props: any) => (
    <div>
      <div data-testid='unread'>{props.unreadCount}</div>
      <div data-testid='total'>{props.list.total}</div>
      <button type='button' onClick={() => props.handleMarkRead(7)}>
        markRead
      </button>
      <button type='button' onClick={() => props.handleMarkAllRead()}>
        markAllRead
      </button>
      <button type='button' onClick={() => props.handleDelete(7)}>
        delete
      </button>
      <button type='button' onClick={() => props.loadNotifications()}>
        reload
      </button>
      <button
        type='button'
        onClick={() =>
          props.handleFilterChange('status')({
            target: { value: 'read' },
          } as ChangeEvent<HTMLSelectElement>)
        }
      >
        fStatus
      </button>
      <button
        type='button'
        onClick={() =>
          props.handleFilterChange('type')({
            target: { value: 'info' },
          } as ChangeEvent<HTMLSelectElement>)
        }
      >
        fType
      </button>
      <button
        type='button'
        onClick={() =>
          props.handleFilterChange('priority')({
            target: { value: 'high' },
          } as ChangeEvent<HTMLSelectElement>)
        }
      >
        fPriority
      </button>
      <input aria-label='title' onChange={(e) => props.handleFormChange('title')(e)} />
      <input aria-label='message' onChange={(e) => props.handleFormChange('message')(e)} />
      <select aria-label='type' onChange={(e) => props.handleFormChange('type')(e)}>
        <option value='info'>info</option>
        <option value='error'>error</option>
      </select>
      <select aria-label='priority' onChange={(e) => props.handleFormChange('priority')(e)}>
        <option value='medium'>medium</option>
        <option value='low'>low</option>
      </select>
      <button type='button' onClick={() => props.setShowSendModal(true)}>
        openModal
      </button>
      <button type='button' onClick={() => props.setShowSendModal(false)}>
        closeModal
      </button>
      <form onSubmit={props.handleSendNotification}>
        <button type='submit'>send</button>
      </form>
      <span data-testid='gc-success'>{props.getTypeColor('success')}</span>
      <span data-testid='gc-warning'>{props.getTypeColor('warning')}</span>
      <span data-testid='gc-error'>{props.getTypeColor('error')}</span>
      <span data-testid='gc-default'>{props.getTypeColor('other')}</span>
      <span data-testid='gi-success'>{props.getTypeIcon('success')}</span>
      <span data-testid='gi-warning'>{props.getTypeIcon('warning')}</span>
      <span data-testid='gi-error'>{props.getTypeIcon('error')}</span>
      <span data-testid='gi-default'>{props.getTypeIcon('info')}</span>
      <span data-testid='gl-info'>{props.getTypeLabel('info')}</span>
      <span data-testid='gl-success'>{props.getTypeLabel('success')}</span>
      <span data-testid='gl-warning'>{props.getTypeLabel('warning')}</span>
      <span data-testid='gl-error'>{props.getTypeLabel('error')}</span>
      <span data-testid='gl-default'>{props.getTypeLabel('custom')}</span>
      <span data-testid='pc-high'>{props.getPriorityColor('high')}</span>
      <span data-testid='pc-medium'>{props.getPriorityColor('medium')}</span>
      <span data-testid='pc-default'>{props.getPriorityColor('low')}</span>
      <span data-testid='pl-high'>{props.getPriorityLabel('high')}</span>
      <span data-testid='pl-medium'>{props.getPriorityLabel('medium')}</span>
      <span data-testid='pl-default'>{props.getPriorityLabel('low')}</span>
      <button type='button' onClick={() => props.setPage(2)}>
        setPage
      </button>
    </div>
  )),
}));

const mockGetAll = api.adminNotifications.getAll as any;
const mockMarkRead = api.adminNotifications.markRead as any;
const mockMarkAllRead = api.adminNotifications.markAllRead as any;
const mockDelete = api.adminNotifications.delete as any;
const mockCreate = api.adminNotifications.create as any;

const sampleItems = (n = 3) =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    is_read: i % 2 === 0,
    type: 'info',
    priority: 'medium',
    title: 't',
    message: 'm',
  }));

const flush = () => waitFor(() => expect(screen.getByTestId('total')).toBeTruthy());

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockGetAll.mockResolvedValue({ notifications: sampleItems(), total: 3 });
  mockMarkRead.mockResolvedValue(undefined);
  mockMarkAllRead.mockResolvedValue({ message: '全部已读' });
  mockDelete.mockResolvedValue(undefined);
  mockCreate.mockResolvedValue({
    notification: { id: 99, is_read: false, type: 'info', priority: 'medium' },
  });
});

describe('Notifications', () => {
  it('挂载：fetcher 成功，列表填充，各 getter 分支覆盖', async () => {
    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );
    await flush();
    expect(mockGetAll).toHaveBeenCalled();
    expect(screen.getByTestId('gc-success').textContent).toContain('green');
    expect(screen.getByTestId('gc-warning').textContent).toContain('amber');
    expect(screen.getByTestId('gc-error').textContent).toContain('red');
    expect(screen.getByTestId('gc-default').textContent).toContain('blue');
    expect(screen.getByTestId('gi-default')).toBeTruthy();
    expect(screen.getByTestId('gl-default').textContent).toBe('custom');
    expect(screen.getByTestId('pc-default').textContent).toContain('gray');
    expect(screen.getByTestId('pl-default').textContent).toBe('低优先级');
  });

  it('adminId 存在路径（localStorage.admin）', async () => {
    localStorage.setItem('admin', JSON.stringify({ id: 5 }));
    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );
    await flush();
    expect(mockGetAll).toHaveBeenCalledWith(expect.objectContaining({ admin_id: 5 }));
  });

  it('fetcher 失败 → fetcher 内 catch（showToast error）', async () => {
    mockGetAll.mockRejectedValue(new Error('boom'));
    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );
    await waitFor(() => expect(mockGetAll).toHaveBeenCalled());
  });

  it('handleMarkRead 成功', async () => {
    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );
    await flush();
    fireEvent.click(screen.getByText('markRead'));
    await waitFor(() => expect(mockMarkRead).toHaveBeenCalledWith(7));
  });

  it('handleMarkRead 失败', async () => {
    mockMarkRead.mockRejectedValue(new Error('mk fail'));
    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );
    await flush();
    fireEvent.click(screen.getByText('markRead'));
    await waitFor(() => expect(mockMarkRead).toHaveBeenCalled());
  });

  it('handleMarkAllRead 成功（带 message）', async () => {
    mockMarkAllRead.mockResolvedValue({ message: 'done' });
    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );
    await flush();
    fireEvent.click(screen.getByText('markAllRead'));
    await waitFor(() => expect(mockMarkAllRead).toHaveBeenCalled());
  });

  it('handleMarkAllRead 失败', async () => {
    mockMarkAllRead.mockRejectedValue(new Error('all fail'));
    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );
    await flush();
    fireEvent.click(screen.getByText('markAllRead'));
    await waitFor(() => expect(mockMarkAllRead).toHaveBeenCalled());
  });

  it('handleDelete 取消（confirm=false）→ 不调 api.delete', async () => {
    confirmFn.mockResolvedValue(false);
    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );
    await flush();
    fireEvent.click(screen.getByText('delete'));
    await waitFor(() => expect(confirmFn).toHaveBeenCalled());
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('handleDelete 成功', async () => {
    confirmFn.mockResolvedValue(true);
    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );
    await flush();
    fireEvent.click(screen.getByText('delete'));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(7));
  });

  it('handleDelete 失败', async () => {
    confirmFn.mockResolvedValue(true);
    mockDelete.mockRejectedValue(new Error('del fail'));
    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );
    await flush();
    fireEvent.click(screen.getByText('delete'));
    await waitFor(() => expect(mockDelete).toHaveBeenCalled());
  });

  it('handleFilterChange 三个字段', async () => {
    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );
    await flush();
    fireEvent.click(screen.getByText('fStatus'));
    fireEvent.click(screen.getByText('fType'));
    fireEvent.click(screen.getByText('fPriority'));
  });

  it('handleFormChange 全部字段', async () => {
    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );
    await flush();
    fireEvent.change(screen.getByLabelText('title'), { target: { value: 'hello' } });
    fireEvent.change(screen.getByLabelText('message'), { target: { value: 'world' } });
    fireEvent.change(screen.getByLabelText('type'), { target: { value: 'error' } });
    fireEvent.change(screen.getByLabelText('priority'), { target: { value: 'low' } });
  });

  it('handleSendNotification 成功（带回 notification → 前置插入）', async () => {
    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );
    await flush();
    fireEvent.click(screen.getByText('send'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
  });

  it('handleSendNotification 成功（无 notification → 重新拉取）', async () => {
    mockCreate.mockResolvedValue({});
    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );
    await flush();
    fireEvent.click(screen.getByText('send'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
  });

  it('handleSendNotification 失败', async () => {
    mockCreate.mockRejectedValue(new Error('send fail'));
    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );
    await flush();
    fireEvent.click(screen.getByText('send'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
  });

  it('loadNotifications（refetch）路径', async () => {
    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );
    await flush();
    fireEvent.click(screen.getByText('reload'));
    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(2));
  });

  it('modal 开/关、setPage', async () => {
    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );
    await flush();
    fireEvent.click(screen.getByText('openModal'));
    fireEvent.click(screen.getByText('closeModal'));
    fireEvent.click(screen.getByText('setPage'));
  });

  it('unreadCount 反映 items', async () => {
    mockGetAll.mockResolvedValue({ notifications: sampleItems(4), total: 4 });
    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );
    await flush();
    expect(screen.getByTestId('unread').textContent).toBe('2');
  });
});
