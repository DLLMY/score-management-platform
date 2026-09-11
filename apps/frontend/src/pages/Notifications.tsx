import logger from '../utils/logger';
/**
 * 通知管理页面（逻辑层）。
 *
 * 主渲染 JSX 已拆到 ./notifications/NotificationsView，本文件只保留
 * 数据加载、乐观更新与交互 handler。
 */

import { useState, useCallback, useMemo, useRef, FormEvent, ChangeEvent } from 'react';
import { Check, X, Info, Sparkles } from 'lucide-react';
import api, { AdminNotification } from '../services/api';
import { useStableToast, useListFetch } from '../hooks';
import { useConfirm } from '../components';
import NotificationsView from './notifications/NotificationsView';
import type { SendForm } from './notifications/types';

function Notifications() {
  const { showToast } = useStableToast();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;
  // A 轨：通知列表迁 useListFetch（乐观更新走 mutate/setTotal）
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [showSendModal, setShowSendModal] = useState<boolean>(false);
  const [sendForm, setSendForm] = useState<SendForm>({
    title: '',
    message: '',
    type: 'info',
    priority: 'medium',
  });
  const [sending, setSending] = useState<boolean>(false);

  // 使用 useMemo 缓存 adminId，避免重复读取 localStorage
  const adminId = useMemo((): number | undefined => {
    const savedAdmin = localStorage.getItem('admin');
    if (savedAdmin) {
      const parsedAdmin = JSON.parse(savedAdmin);
      return parsedAdmin.id;
    }
    return undefined;
  }, []);

  // A 轨：useListFetch 接管分页/过滤/竞态（abort 内建）；失败 toast 由 fetcher 兜底
  const list = useListFetch<AdminNotification>({
    params: {
      page,
      pageSize: PER_PAGE,
      admin_id: adminId,
      is_read: filterStatus || undefined,
      type: filterType || undefined,
      priority: filterPriority || undefined,
    },
    fetcher: async ({ page: pg, pageSize, admin_id, is_read, type, priority }) => {
      try {
        const data = await api.adminNotifications.getAll({
          admin_id: admin_id as number | undefined,
          page: pg,
          per_page: pageSize,
          is_read: is_read as string | undefined,
          type: type as string | undefined,
          priority: priority as string | undefined,
        });
        return { items: data.notifications ?? [], total: data.total ?? 0 };
      } catch (error) {
        logger.error('加载通知失败:', error);
        showToast('error', '加载通知失败');
        throw error;
      }
    },
  });
  // 既有按钮/回退路径仍以 loadNotifications 命名调用（语义 = 重新拉取当前页）
  const loadNotifications = useCallback(() => {
    void list.refetch();
  }, [list]);

  const handleMarkRead = useCallback(
    async (id: number): Promise<void> => {
      try {
        await api.adminNotifications.markRead(id);
        list.mutate({ items: list.items.map((n) => (n.id === id ? { ...n, is_read: true } : n)) });
        showToast('success', '已标记为已读');
      } catch (error) {
        logger.error('标记已读失败:', error);
        showToast('error', '操作失败: ' + ((error as Error).message || ''));
      }
    },
    [showToast, list]
  );

  const handleMarkAllRead = useCallback(async (): Promise<void> => {
    try {
      const result = await api.adminNotifications.markAllRead(adminId);
      list.mutate({ items: list.items.map((n) => ({ ...n, is_read: true })) });
      showToast('success', result.message || '全部已读');
    } catch (error) {
      logger.error('全部已读失败:', error);
      showToast('error', '操作失败: ' + ((error as Error).message || ''));
    }
  }, [adminId, showToast, list]);

  const handleDelete = useCallback(
    async (id: number): Promise<void> => {
      const ok = await confirmRef.current({
        message: '确定要删除这条通知吗？',
        confirmText: '确定',
        cancelText: '取消',
        type: 'danger',
      });
      if (!ok) return;
      try {
        await api.adminNotifications.delete(id);
        const nextTotal = Math.max(0, list.total - 1);
        const nextPages = Math.max(1, Math.ceil(nextTotal / PER_PAGE));
        list.mutate({ items: list.items.filter((n) => n.id !== id), total: nextTotal });
        if (page > nextPages) setPage(nextPages); // M4: 末页删除回退
        showToast('success', '删除成功');
      } catch (error) {
        logger.error('删除通知失败:', error);
        showToast('error', '删除失败: ' + ((error as Error).message || ''));
      }
    },
    [showToast, list, page]
  );

  const handleSendNotification = useCallback(
    async (e: FormEvent<HTMLFormElement>): Promise<void> => {
      e.preventDefault();
      if (sending) return; // M2: 防重复提交
      setSending(true);
      try {
        const result = await api.adminNotifications.create({ ...sendForm, admin_id: adminId });
        setShowSendModal(false);
        setSendForm({ title: '', message: '', type: 'info', priority: 'medium' });
        // M4: 后端返回 data: {notification} 则前置插入；否则重新拉取保证列表与总数一致
        if (result && result.notification) {
          list.mutate({ items: [result.notification, ...list.items], total: list.total + 1 });
        } else {
          loadNotifications();
        }
        showToast('success', '通知发送成功');
      } catch (error) {
        logger.error('发送通知失败:', error);
        showToast('error', '发送失败: ' + ((error as Error).message || ''));
      } finally {
        setSending(false);
      }
    },
    [sendForm, adminId, showToast, sending, loadNotifications, list]
  );

  const getTypeColor = useMemo(() => {
    return (type: string) => {
      switch (type) {
        case 'success':
          return 'bg-green-100 text-green-700';
        case 'warning':
          return 'bg-amber-100 text-amber-700';
        case 'error':
          return 'bg-red-100 text-red-700';
        default:
          return 'bg-blue-100 text-blue-700';
      }
    };
  }, []);

  const getTypeIcon = useMemo(() => {
    return (type: string) => {
      switch (type) {
        case 'success':
          return <Check className='w-4 h-4 text-green-600' />;
        case 'warning':
          return <Sparkles className='w-4 h-4 text-amber-600' />;
        case 'error':
          return <X className='w-4 h-4 text-red-600' />;
        default:
          return <Info className='w-4 h-4 text-blue-600' />;
      }
    };
  }, []);

  const getTypeLabel = useMemo(() => {
    return (type: string) => {
      switch (type) {
        case 'info':
          return '信息';
        case 'success':
          return '成功';
        case 'warning':
          return '警告';
        case 'error':
          return '错误';
        default:
          return type;
      }
    };
  }, []);

  const getPriorityColor = useMemo(() => {
    return (priority: string) => {
      switch (priority) {
        case 'high':
          return 'bg-red-100 text-red-700';
        case 'medium':
          return 'bg-amber-100 text-amber-700';
        default:
          return 'bg-gray-100 text-gray-700';
      }
    };
  }, []);

  const getPriorityLabel = useMemo(() => {
    return (priority: string) => {
      switch (priority) {
        case 'high':
          return '高优先级';
        case 'medium':
          return '中优先级';
        default:
          return '低优先级';
      }
    };
  }, []);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(list.total / PER_PAGE)), [list.total]);

  const handleFilterChange =
    (field: 'status' | 'type' | 'priority') =>
    (e: ChangeEvent<HTMLSelectElement>): void => {
      if (field === 'status') setFilterStatus(e.target.value);
      if (field === 'type') setFilterType(e.target.value);
      if (field === 'priority') setFilterPriority(e.target.value);
      setPage(1);
    };

  const handleFormChange =
    (field: keyof SendForm) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void => {
      setSendForm((prev: SendForm) => ({ ...prev, [field]: e.target.value }));
    };

  const unreadCount = useMemo(() => {
    return list.items.filter((n) => !n.is_read).length;
  }, [list.items]);

  return (
    <NotificationsView
      list={list}
      loadNotifications={loadNotifications}
      page={page}
      setPage={setPage}
      totalPages={totalPages}
      filterStatus={filterStatus}
      filterType={filterType}
      filterPriority={filterPriority}
      handleFilterChange={handleFilterChange}
      handleMarkRead={handleMarkRead}
      handleMarkAllRead={handleMarkAllRead}
      handleDelete={handleDelete}
      showSendModal={showSendModal}
      setShowSendModal={setShowSendModal}
      sendForm={sendForm}
      setSendForm={setSendForm}
      handleFormChange={handleFormChange}
      handleSendNotification={handleSendNotification}
      sending={sending}
      unreadCount={unreadCount}
      getTypeColor={getTypeColor}
      getTypeLabel={getTypeLabel}
      getTypeIcon={getTypeIcon}
      getPriorityColor={getPriorityColor}
      getPriorityLabel={getPriorityLabel}
    />
  );
}

export default Notifications;
