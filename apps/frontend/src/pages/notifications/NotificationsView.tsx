import React from 'react';
/**
 * 通知管理页视图层。
 *
 * 承接原 Notifications.tsx 的主渲染 JSX，全部数据经 NotificationsViewProps 注入。
 */

import { Bell, Filter, Check, Trash2, RefreshCw } from 'lucide-react';
import { Card, Button, Modal, PermissionButton } from '../../components';
import { formatRelativeTime } from '../../utils/format';
import type { AdminNotification } from '../../services/api';
import type { NotificationsViewProps } from './types';

const NotificationsView: React.FC<NotificationsViewProps> = ({
  list,
  loadNotifications,
  page,
  setPage,
  totalPages,
  filterStatus,
  filterType,
  filterPriority,
  handleFilterChange,
  handleMarkRead,
  handleMarkAllRead,
  handleDelete,
  showSendModal,
  setShowSendModal,
  sendForm,
  setSendForm,
  handleFormChange,
  handleSendNotification,
  sending,
  unreadCount,
  getTypeColor,
  getTypeLabel,
  getTypeIcon,
  getPriorityColor,
  getPriorityLabel,
}) => {
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
          <PermissionButton
            permission='notification.send'
            onClick={() => setShowSendModal(true)}
            size='sm'
          >
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
            <RefreshCw className={`w-4 h-4 ${list.loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>

        {list.loading ? (
          <div className='flex flex-col items-center justify-center py-12'>
            <RefreshCw className='w-8 h-8 text-primary-500 animate-spin mb-4' />
            <p className='text-gray-500'>加载中...</p>
          </div>
        ) : list.items.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-12'>
            <Bell className='w-12 h-12 text-gray-300 mb-4' />
            <p className='text-gray-500'>暂无通知</p>
            <p className='text-gray-400 text-sm mt-1'>点击右上角「发送通知」给师生下发消息</p>{' '}
            {/* L3: 空态引导 */}
          </div>
        ) : (
          <div className='space-y-3'>
            {list.items.map((notification: AdminNotification) => (
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
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        notification.type === 'success'
                          ? 'bg-green-100'
                          : notification.type === 'warning'
                          ? 'bg-amber-100'
                          : notification.type === 'error'
                          ? 'bg-red-100'
                          : 'bg-blue-100'
                      }`}
                    >
                      {getTypeIcon(notification.type)}
                    </div>
                    <div className='flex-1'>
                      <div className='flex flex-wrap items-center gap-2 mb-1'>
                        <h4 className='font-medium text-gray-900 text-sm sm:text-base'>
                          {notification.title}
                        </h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(
                            notification.type
                          )}`}
                        >
                          {getTypeLabel(notification.type)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(
                            notification.priority
                          )}`}
                        >
                          {getPriorityLabel(notification.priority)}
                        </span>
                        {!notification.is_read && (
                          <span className='w-2 h-2 bg-blue-500 rounded-full animate-pulse' />
                        )}
                      </div>
                      <p className='text-sm text-gray-600 mb-2 hidden sm:block'>
                        {notification.message}
                      </p>
                      <div className='flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-gray-500'>
                        <span>{formatRelativeTime(notification.created_at)}</span>
                        {notification.read_at && (
                          <span>已读于 {formatRelativeTime(notification.read_at)}</span>
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
            <p className='text-sm text-gray-500'>共 {list.total} 条记录</p>
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                上一页
              </Button>
              <span className='text-sm text-gray-600'>
                第 {page} 页 / 共 {totalPages} 页
              </span>
              <Button
                variant='outline'
                size='sm'
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Modal
        isOpen={showSendModal}
        onClose={() => {
          setShowSendModal(false);
          setSendForm({ title: '', message: '', type: 'info', priority: 'medium' });
        }}
        title='发送通知'
      >
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
            <Button
              variant='outline'
              onClick={() => {
                setShowSendModal(false);
                setSendForm({ title: '', message: '', type: 'info', priority: 'medium' });
              }}
              disabled={sending}
            >
              取消
            </Button>
            <Button type='submit' disabled={sending}>
              <Bell className='w-4 h-4' />
              {sending ? '发送中...' : '发送通知'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default NotificationsView;
