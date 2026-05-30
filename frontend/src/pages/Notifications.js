import { useState, useEffect, useCallback, useMemo } from 'react';
import { Bell, Filter, Check, Trash2, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, Button, Modal } from '../components';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

function Notifications() {
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendForm, setSendForm] = useState({ user_id: '', title: '', content: '', type: 'info' });
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0 });

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page: pagination.page, per_page: pagination.per_page };
      if (filterStatus) params.status = filterStatus;
      const data = await api.notifications.getAll(params);
      setNotifications(data.notifications);
      setPagination((prev) => ({ ...prev, total: data.total }));
    } catch (error) {
      console.error('加载通知失败:', error);
      showToast('加载通知失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.per_page, filterStatus, showToast]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkRead = useCallback(
    async (id) => {
      try {
        await api.notifications.markRead(id);
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: 'read' } : n)));
        showToast('已标记为已读', 'success');
      } catch (error) {
        showToast('操作失败', 'error');
      }
    },
    [showToast]
  );

  const handleDelete = useCallback(
    async (id) => {
      if (!window.confirm('确定要删除这条通知吗？')) return;
      try {
        await api.notifications.delete(id);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        showToast('删除成功', 'success');
      } catch (error) {
        showToast('删除失败', 'error');
      }
    },
    [showToast]
  );

  const handleSendNotification = useCallback(
    async (e) => {
      e.preventDefault();
      try {
        const newNotification = await api.notifications.send(sendForm);
        setShowSendModal(false);
        setSendForm({ user_id: '', title: '', content: '', type: 'info' });
        setNotifications((prev) => [newNotification, ...prev]);
        showToast('通知发送成功', 'success');
      } catch (error) {
        showToast('发送失败', 'error');
      }
    },
    [sendForm, showToast]
  );

  const getStatusIcon = useMemo(() => {
    return (status) => {
      switch (status) {
        case 'pending':
          return <AlertCircle className='w-4 h-4 text-yellow-600' />;
        case 'read':
          return <CheckCircle className='w-4 h-4 text-green-600' />;
        default:
          return <Bell className='w-4 h-4 text-gray-400' />;
      }
    };
  }, []);

  const getTypeColor = useMemo(() => {
    return (type) => {
      switch (type) {
        case 'success':
          return 'bg-green-100 text-green-700';
        case 'warning':
          return 'bg-yellow-100 text-yellow-700';
        case 'error':
          return 'bg-red-100 text-red-700';
        default:
          return 'bg-blue-100 text-blue-700';
      }
    };
  }, []);

  const totalPages = useMemo(() => {
    return Math.ceil(pagination.total / pagination.per_page);
  }, [pagination.total, pagination.per_page]);

  return (
    <div className='max-w-4xl mx-auto'>
      <div className='flex items-center justify-between mb-6'>
        <div className='flex items-center gap-3'>
          <div className='w-12 h-12 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30'>
            <Bell className='w-6 h-6 text-white' />
          </div>
          <div>
            <h2 className='text-xl font-bold text-gray-900'>通知管理</h2>
            <p className='text-sm text-gray-500'>发送和管理系统通知</p>
          </div>
        </div>
        <Button onClick={() => setShowSendModal(true)}>
          <Bell className='w-4 h-4' />
          发送通知
        </Button>
      </div>

      <Card title='通知列表'>
        <div className='flex items-center gap-4 mb-4 flex-wrap'>
          <div className='flex items-center gap-2'>
            <Filter className='w-4 h-4 text-gray-500' />
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className='px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
            >
              <option value=''>全部状态</option>
              <option value='pending'>未读</option>
              <option value='read'>已读</option>
            </select>
          </div>
          <Button variant='outline' onClick={loadNotifications} size='small'>
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
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-xl border transition-colors ${
                  notification.status === 'pending'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-white border-gray-100 hover:bg-gray-50'
                }`}
              >
                <div className='flex items-start justify-between'>
                  <div className='flex items-start gap-3 flex-1'>
                    {getStatusIcon(notification.status)}
                    <div className='flex-1'>
                      <div className='flex items-center gap-2 mb-1'>
                        <h4 className='font-medium text-gray-900'>{notification.title}</h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(notification.type)}`}
                        >
                          {notification.type === 'info'
                            ? '信息'
                            : notification.type === 'success'
                              ? '成功'
                              : notification.type === 'warning'
                                ? '警告'
                                : '错误'}
                        </span>
                      </div>
                      <p className='text-sm text-gray-600 mb-2'>{notification.content}</p>
                      <div className='flex items-center gap-4 text-xs text-gray-500'>
                        <span>用户ID: {notification.user_id}</span>
                        <span>{new Date(notification.created_at).toLocaleString('zh-CN')}</span>
                      </div>
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    {notification.status === 'pending' && (
                      <Button
                        variant='outline'
                        size='small'
                        onClick={() => handleMarkRead(notification.id)}
                      >
                        <Check className='w-3 h-3' />
                        标为已读
                      </Button>
                    )}
                    <Button
                      variant='outline'
                      size='small'
                      onClick={() => handleDelete(notification.id)}
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
                size='small'
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              >
                上一页
              </Button>
              <span className='text-sm text-gray-600'>
                第 {pagination.page} 页 / 共 {totalPages} 页
              </span>
              <Button
                variant='outline'
                size='small'
                disabled={pagination.page >= totalPages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
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
            <label className='block text-sm font-medium text-gray-700 mb-1'>用户ID</label>
            <input
              type='number'
              value={sendForm.user_id}
              onChange={(e) => setSendForm({ ...sendForm, user_id: e.target.value })}
              className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
              placeholder='请输入用户ID（留空则发送给所有用户）'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>通知标题</label>
            <input
              type='text'
              value={sendForm.title}
              onChange={(e) => setSendForm({ ...sendForm, title: e.target.value })}
              className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
              placeholder='请输入通知标题'
              required
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>通知类型</label>
            <select
              value={sendForm.type}
              onChange={(e) => setSendForm({ ...sendForm, type: e.target.value })}
              className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
            >
              <option value='info'>信息</option>
              <option value='success'>成功</option>
              <option value='warning'>警告</option>
              <option value='error'>错误</option>
            </select>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>通知内容</label>
            <textarea
              value={sendForm.content}
              onChange={(e) => setSendForm({ ...sendForm, content: e.target.value })}
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
