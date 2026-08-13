import { useState, useEffect, useCallback, useMemo, FormEvent, ChangeEvent } from 'react';
import { Bell, Filter, Check, Trash2, RefreshCw, Sparkles, X, Info } from 'lucide-react';
import { Card, Button, Modal, PermissionButton } from '../components';
import api, { AdminNotification } from '../services/api';
import { useStableToast } from '../hooks/useStableToast';

interface SendForm {
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  priority: 'high' | 'medium' | 'low';
}

interface Pagination {
  page: number;
  per_page: number;
  total: number;
  pages: number;
}

function Notifications() {
  const { showToast } = useStableToast();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [showSendModal, setShowSendModal] = useState<boolean>(false);
  const [sendForm, setSendForm] = useState<SendForm>({ title: '', message: '', type: 'info', priority: 'medium' });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, per_page: 20, total: 0, pages: 0 });

  // 使用 useMemo 缓存 adminId，避免重复读取 localStorage
  const adminId = useMemo((): number | undefined => {
    const savedAdmin = localStorage.getItem('admin');
    if (savedAdmin) {
      const parsedAdmin = JSON.parse(savedAdmin);
      return parsedAdmin.id;
    }
    return undefined;
  }, []);

  const loadNotifications = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const params: { admin_id?: number; page: number; per_page: number; is_read?: string; type?: string; priority?: string } = {
        admin_id: adminId,
        page: pagination.page,
        per_page: pagination.per_page,
      };
      if (filterStatus) params.is_read = filterStatus;
      if (filterType) params.type = filterType;
      if (filterPriority) params.priority = filterPriority;
      const data = await api.adminNotifications.getAll(params);
      setNotifications(data.notifications || []);
      setPagination((prev: Pagination) => ({
        ...prev,
        total: data.total || 0,
        pages: data.pages || 0,
      }));
    } catch (error) {
      console.error('加载通知失败:', error);
      showToast('error', '加载通知失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.per_page, filterStatus, filterType, filterPriority, adminId, showToast]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkRead = useCallback(
    async (id: number): Promise<void> => {
      try {
        await api.adminNotifications.markRead(id);
        setNotifications((prev: AdminNotification[]) => prev.map((n: AdminNotification) => (n.id === id ? { ...n, is_read: true } : n)));
        showToast('success', '已标记为已读');
      } catch (error) {
        console.error('标记已读失败:', error);
        showToast('error', '操作失败: ' + ((error as Error).message || ''));
      }
    },
    [showToast]
  );

  const handleMarkAllRead = useCallback(async (): Promise<void> => {
    try {
      const result = await api.adminNotifications.markAllRead(adminId);
      setNotifications((prev: AdminNotification[]) => prev.map((n: AdminNotification) => ({ ...n, is_read: true })));
      showToast('success', result.message || '全部已读');
    } catch (error) {
      console.error('全部已读失败:', error);
      showToast('error', '操作失败: ' + ((error as Error).message || ''));
    }
  }, [adminId, showToast]);

  const handleDelete = useCallback(
    async (id: number): Promise<void> => {
      if (!window.confirm('确定要删除这条通知吗？')) return;
      try {
        await api.adminNotifications.delete(id);
        setNotifications((prev: AdminNotification[]) => prev.filter((n: AdminNotification) => n.id !== id));
        showToast('success', '删除成功');
      } catch (error) {
        console.error('删除通知失败:', error);
        showToast('error', '删除失败: ' + ((error as Error).message || ''));
      }
    },
    [showToast]
  );

  const handleSendNotification = useCallback(
    async (e: FormEvent<HTMLFormElement>): Promise<void> => {
      e.preventDefault();
      try {
        const result = await api.adminNotifications.create({ ...sendForm, admin_id: adminId });
        setShowSendModal(false);
        setSendForm({ title: '', message: '', type: 'info', priority: 'medium' });
        // 后端返回 data: {notification}; 防御性校验，缺失时不插入假条目
        if (result && result.notification) {
          setNotifications((prev: AdminNotification[]) => [result.notification, ...prev]);
        }
        showToast('success', '通知发送成功');
      } catch (error) {
        console.error('发送通知失败:', error);
        showToast('error', '发送失败: ' + ((error as Error).message || ''));
      }
    },
    [sendForm, adminId, showToast]
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

  const formatTime = useCallback((dateString: string | null | undefined) => {
    if (!dateString) return '--';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '--';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleString('zh-CN');
  }, []);

  const totalPages = useMemo(() => {
    return pagination.pages || Math.ceil(pagination.total / pagination.per_page);
  }, [pagination.total, pagination.per_page, pagination.pages]);

  const handleFilterChange = (field: 'status' | 'type' | 'priority') => (e: ChangeEvent<HTMLSelectElement>): void => {
    if (field === 'status') setFilterStatus(e.target.value);
    if (field === 'type') setFilterType(e.target.value);
    if (field === 'priority') setFilterPriority(e.target.value);
    setPagination((prev: Pagination) => ({ ...prev, page: 1 }));
  };

  const handleFormChange = (field: keyof SendForm) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void => {
    setSendForm((prev: SendForm) => ({ ...prev, [field]: e.target.value }));
  };

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  return (
    <div className='max-w-4xl mx-auto px-4 sm:px-6'>
      <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6'>
        <div className='flex items-center gap-3'>
          <div className='w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30'>
            <Bell className='w-5 h-5 sm:w-6 sm:h-6 text-white' />
          </div>
          <div>
            <h2 className='text-lg sm:text-xl font-bold text-gray-900'>通知中心</h2>
            <p className='text-sm text-gray-500'>查看和管理系统通知</p>
          </div>
        </div>
        <div className='flex items-center gap-2 sm:gap-3'>
          {unreadCount > 0 && (
            <Button variant='outline' onClick={handleMarkAllRead} size='sm'>
              <Check className='w-4 h-4' />
              全部已读
            </Button>
          )}
          <PermissionButton permission='notification.send' onClick={() => setShowSendModal(true)} size='sm'>
            <Bell className='w-4 h-4' />
            发送通知
          </PermissionButton>
        </div>
      </div>

      <Card title='通知列表'>
        <div className='flex items-center gap-4 mb-4 flex-wrap'>
          <div className='flex items-center gap-2'>
            <Filter className='w-4 h-4 text-gray-500' />
            <select
              value={filterStatus}
              onChange={handleFilterChange('status')}
              className='px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
            >
              <option value=''>全部状态</option>
              <option value='false'>未读</option>
              <option value='true'>已读</option>
            </select>
          </div>
          <div className='flex items-center gap-2'>
            <select
              value={filterType}
              onChange={handleFilterChange('type')}
              className='px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
            >
              <option value=''>全部类型</option>
              <option value='info'>信息</option>
              <option value='success'>成功</option>
              <option value='warning'>警告</option>
              <option value='error'>错误</option>
            </select>
          </div>
          <div className='flex items-center gap-2'>
            <select
              value={filterPriority}
              onChange={handleFilterChange('priority')}
              className='px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
            >
              <option value=''>全部优先级</option>
              <option value='high'>高优先级</option>
              <option value='medium'>中优先级</option>
              <option value='low'>低优先级</option>
            </select>
          </div>
          <Button variant='outline' onClick={loadNotifications} size='sm'>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>

        {loading ? (
          <div className='flex flex-col items-center justify-center py-12'>
            <RefreshCw className='w-8 h-8 text-primary-500 animate-spin mb-4' />
            <p className='text-gray-500'>加载中...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-12'>
            <Bell className='w-12 h-12 text-gray-300 mb-4' />
            <p className='text-gray-500'>暂无通知</p>
          </div>
        ) : (
          <div className='space-y-3'>
            {notifications.map((notification: AdminNotification) => (
              <div
                key={notification.id}
                className={`p-3 sm:p-4 rounded-xl border transition-colors ${
                  !notification.is_read
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white border-gray-100 hover:bg-gray-50'
                }`}
              >
                <div className='flex flex-col sm:flex-row items-start sm:items-start justify-between gap-3'>
                  <div className='flex items-start gap-3 flex-1 w-full'>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      notification.type === 'success' ? 'bg-green-100' :
                      notification.type === 'warning' ? 'bg-amber-100' :
                      notification.type === 'error' ? 'bg-red-100' : 'bg-blue-100'
                    }`}>
                      {getTypeIcon(notification.type)}
                    </div>
                    <div className='flex-1'>
                      <div className='flex flex-wrap items-center gap-2 mb-1'>
                        <h4 className='font-medium text-gray-900 text-sm sm:text-base'>{notification.title}</h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(notification.type)}`}
                        >
                          {getTypeLabel(notification.type)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(notification.priority)}`}
                        >
                          {getPriorityLabel(notification.priority)}
                        </span>
                        {!notification.is_read && (
                          <span className='w-2 h-2 bg-blue-500 rounded-full animate-pulse' />
                        )}
                      </div>
                      <p className='text-sm text-gray-600 mb-2 hidden sm:block'>{notification.message}</p>
                      <div className='flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-gray-500'>
                        <span>{formatTime(notification.created_at)}</span>
                        {notification.read_at && (
                          <span>已读于 {formatTime(notification.read_at)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className='flex items-center gap-2 sm:ml-4'>
                    {!notification.is_read && (
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handleMarkRead(notification.id)}
                        className='py-1.5 px-2 text-xs sm:py-2 sm:px-3 sm:text-sm'
                      >
                        <Check className='w-3 h-3' />
                        标为已读
                      </Button>
                    )}
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => handleDelete(notification.id)}
                      className='py-1.5 px-2 text-xs sm:py-2 sm:px-3 sm:text-sm'
                    >
                      <Trash2 className='w-3 h-3' />
                      删除
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className='flex items-center justify-between mt-6 pt-4 border-t border-gray-100'>
            <p className='text-sm text-gray-500'>共 {pagination.total} 条记录</p>
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev: Pagination) => ({ ...prev, page: prev.page - 1 }))}
              >
                上一页
              </Button>
              <span className='text-sm text-gray-600'>
                第 {pagination.page} 页 / 共 {totalPages} 页
              </span>
              <Button
                variant='outline'
                size='sm'
                disabled={pagination.page >= totalPages}
                onClick={() => setPagination((prev: Pagination) => ({ ...prev, page: prev.page + 1 }))}
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Modal isOpen={showSendModal} onClose={() => setShowSendModal(false)} title='发送通知'>
        <form onSubmit={handleSendNotification} className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>通知标题</label>
            <input
              type='text'
              value={sendForm.title}
              onChange={handleFormChange('title')}
              className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
              placeholder='请输入通知标题'
              required
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>通知类型</label>
            <select
              value={sendForm.type}
              onChange={handleFormChange('type')}
              className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
            >
              <option value='info'>信息</option>
              <option value='success'>成功</option>
              <option value='warning'>警告</option>
              <option value='error'>错误</option>
            </select>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>优先级</label>
            <select
              value={sendForm.priority}
              onChange={handleFormChange('priority')}
              className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
            >
              <option value='low'>低优先级</option>
              <option value='medium'>中优先级</option>
              <option value='high'>高优先级</option>
            </select>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>通知内容</label>
            <textarea
              value={sendForm.message}
              onChange={handleFormChange('message')}
              className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[120px]'
              placeholder='请输入通知内容'
              required
            />
          </div>
          <div className='flex gap-3 pt-4 border-t border-gray-100'>
            <Button variant='outline' onClick={() => setShowSendModal(false)}>
              取消
            </Button>
            <Button type='submit'>
              <Bell className='w-4 h-4' />
              发送通知
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Notifications;