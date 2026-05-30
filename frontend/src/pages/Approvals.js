import { useState, useEffect, useCallback, useMemo } from 'react';
import { ClipboardCheck, Check, X, Filter, RefreshCw, Clock, User, Plus } from 'lucide-react';
import { Card, Button, Modal } from '../components';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

function Approvals() {
  const { showToast } = useToast();
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [createForm, setCreateForm] = useState({
    user_id: '',
    title: '',
    description: '',
    type: 'score_adjust',
    score_change: 0,
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0 });

  const loadApprovals = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page: pagination.page, per_page: pagination.per_page };
      if (filterStatus) params.status = filterStatus;
      const data = await api.approvals.getAll(params);
      setApprovals(data.approvals);
      setPagination((prev) => ({ ...prev, total: data.total }));
    } catch (error) {
      console.error('加载审批失败:', error);
      showToast('加载审批失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.per_page, filterStatus, showToast]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const handleViewDetail = useCallback(
    async (id) => {
      try {
        const data = await api.approvals.getById(id);
        setSelectedApproval(data);
        setShowDetailModal(true);
      } catch (error) {
        showToast('获取详情失败', 'error');
      }
    },
    [showToast]
  );

  const handleApprove = useCallback(
    async (id, comment = '') => {
      if (!window.confirm('确定要通过这个申请吗？')) return;
      try {
        setActionLoading(true);
        await api.approvals.approve(id, { comment });
        setApprovals((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'approved' } : a)));
        setShowDetailModal(false);
        showToast('审批通过', 'success');
      } catch (error) {
        showToast('操作失败', 'error');
      } finally {
        setActionLoading(false);
      }
    },
    [showToast]
  );

  const handleReject = useCallback(
    async (id, comment = '') => {
      if (!window.confirm('确定要拒绝这个申请吗？')) return;
      try {
        setActionLoading(true);
        await api.approvals.reject(id, { comment });
        setApprovals((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'rejected' } : a)));
        setShowDetailModal(false);
        showToast('已拒绝', 'success');
      } catch (error) {
        showToast('操作失败', 'error');
      } finally {
        setActionLoading(false);
      }
    },
    [showToast]
  );

  const handleCreateApproval = useCallback(
    async (e) => {
      e.preventDefault();
      try {
        setActionLoading(true);
        const newApproval = await api.approvals.create(createForm);
        setShowCreateModal(false);
        setCreateForm({
          user_id: '',
          title: '',
          description: '',
          type: 'score_adjust',
          score_change: 0,
        });
        setApprovals((prev) => [newApproval, ...prev]);
        showToast('申请创建成功', 'success');
      } catch (error) {
        showToast('创建失败', 'error');
      } finally {
        setActionLoading(false);
      }
    },
    [createForm, showToast]
  );

  const getStatusBadge = useMemo(() => {
    return (status) => {
      switch (status) {
        case 'pending':
          return (
            <span className='px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium'>
              待审批
            </span>
          );
        case 'approved':
          return (
            <span className='px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium'>
              已通过
            </span>
          );
        case 'rejected':
          return (
            <span className='px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium'>
              已拒绝
            </span>
          );
        default:
          return (
            <span className='px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium'>
              {status}
            </span>
          );
      }
    };
  }, []);

  const getTypeLabel = useMemo(() => {
    return (type) => {
      switch (type) {
        case 'score_adjust':
          return '积分调整';
        case 'special_reward':
          return '特殊奖励';
        case 'other':
          return '其他';
        default:
          return type;
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
            <ClipboardCheck className='w-6 h-6 text-white' />
          </div>
          <div>
            <h2 className='text-xl font-bold text-gray-900'>审批管理</h2>
            <p className='text-sm text-gray-500'>处理积分调整等申请</p>
          </div>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className='w-4 h-4' />
          创建申请
        </Button>
      </div>

      <Card title='申请列表'>
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
              <option value='pending'>待审批</option>
              <option value='approved'>已通过</option>
              <option value='rejected'>已拒绝</option>
            </select>
          </div>
          <Button variant='outline' onClick={loadApprovals} size='small'>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>

        {loading ? (
          <div className='flex flex-col items-center justify-center py-12'>
            <RefreshCw className='w-8 h-8 text-primary-500 animate-spin mb-4' />
            <p className='text-gray-500'>加载中...</p>
          </div>
        ) : approvals.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-12'>
            <ClipboardCheck className='w-12 h-12 text-gray-300 mb-4' />
            <p className='text-gray-500'>暂无申请</p>
          </div>
        ) : (
          <div className='space-y-3'>
            {approvals.map((approval) => (
              <div
                key={approval.id}
                className='p-4 rounded-xl border bg-white border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer'
                onClick={() => handleViewDetail(approval.id)}
              >
                <div className='flex items-start justify-between'>
                  <div className='flex-1'>
                    <div className='flex items-center gap-2 mb-2'>
                      <h4 className='font-medium text-gray-900'>{approval.title}</h4>
                      {getStatusBadge(approval.status)}
                      <span className='px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium'>
                        {getTypeLabel(approval.type)}
                      </span>
                    </div>
                    <p className='text-sm text-gray-600 mb-2'>{approval.description}</p>
                    {approval.score_change !== null && approval.score_change !== undefined && (
                      <p className='text-sm font-medium mb-2'>
                        积分变化:{' '}
                        <span
                          className={approval.score_change >= 0 ? 'text-green-600' : 'text-red-600'}
                        >
                          {approval.score_change >= 0 ? '+' : ''}
                          {approval.score_change}
                        </span>
                      </p>
                    )}
                    <div className='flex items-center gap-4 text-xs text-gray-500'>
                      <div className='flex items-center gap-1'>
                        <User className='w-3 h-3' />
                        <span>用户ID: {approval.user_id}</span>
                      </div>
                      <div className='flex items-center gap-1'>
                        <Clock className='w-3 h-3' />
                        <span>{new Date(approval.created_at).toLocaleString('zh-CN')}</span>
                      </div>
                    </div>
                  </div>
                  {approval.status === 'pending' && (
                    <div className='flex items-center gap-2 ml-4'>
                      <Button
                        variant='outline'
                        size='small'
                        className='text-green-600 border-green-200 hover:bg-green-50'
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApprove(approval.id);
                        }}
                        disabled={actionLoading}
                      >
                        <Check className='w-3 h-3' />
                        通过
                      </Button>
                      <Button
                        variant='outline'
                        size='small'
                        className='text-red-600 border-red-200 hover:bg-red-50'
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReject(approval.id);
                        }}
                        disabled={actionLoading}
                      >
                        <X className='w-3 h-3' />
                        拒绝
                      </Button>
                    </div>
                  )}
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

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title='创建申请'>
        <form onSubmit={handleCreateApproval} className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>用户ID</label>
            <input
              type='number'
              value={createForm.user_id}
              onChange={(e) => setCreateForm({ ...createForm, user_id: e.target.value })}
              className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
              placeholder='请输入用户ID'
              required
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>申请类型</label>
            <select
              value={createForm.type}
              onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
              className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
            >
              <option value='score_adjust'>积分调整</option>
              <option value='special_reward'>特殊奖励</option>
              <option value='other'>其他</option>
            </select>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>申请标题</label>
            <input
              type='text'
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
              placeholder='请输入申请标题'
              required
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>积分变化</label>
            <input
              type='number'
              value={createForm.score_change}
              onChange={(e) =>
                setCreateForm({ ...createForm, score_change: parseInt(e.target.value) || 0 })
              }
              className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
              placeholder='请输入积分变化值（正数为加，负数为减）'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>申请说明</label>
            <textarea
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[100px]'
              placeholder='请输入申请说明'
              required
            />
          </div>
          <div className='flex gap-3 pt-4 border-t border-gray-100'>
            <Button
              variant='outline'
              onClick={() => setShowCreateModal(false)}
              disabled={actionLoading}
            >
              取消
            </Button>
            <Button type='submit' disabled={actionLoading}>
              <Plus className='w-4 h-4' />
              创建申请
            </Button>
          </div>
        </form>
      </Modal>

      {selectedApproval && (
        <Modal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          title='申请详情'
          size='large'
        >
          <div className='space-y-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='text-xs font-medium text-gray-500'>申请标题</label>
                <p className='font-medium text-gray-900'>{selectedApproval.title}</p>
              </div>
              <div>
                <label className='text-xs font-medium text-gray-500'>状态</label>
                <div className='mt-1'>{getStatusBadge(selectedApproval.status)}</div>
              </div>
              <div>
                <label className='text-xs font-medium text-gray-500'>申请类型</label>
                <p className='text-gray-900'>{getTypeLabel(selectedApproval.type)}</p>
              </div>
              <div>
                <label className='text-xs font-medium text-gray-500'>用户</label>
                <p className='text-gray-900'>
                  {selectedApproval.user_name || `用户 ${selectedApproval.user_id}`}
                </p>
              </div>
            </div>
            {selectedApproval.score_change !== null &&
              selectedApproval.score_change !== undefined && (
                <div>
                  <label className='text-xs font-medium text-gray-500'>积分变化</label>
                  <p className='text-xl font-bold mt-1'>
                    <span
                      className={
                        selectedApproval.score_change >= 0 ? 'text-green-600' : 'text-red-600'
                      }
                    >
                      {selectedApproval.score_change >= 0 ? '+' : ''}
                      {selectedApproval.score_change}
                    </span>
                  </p>
                </div>
              )}
            <div>
              <label className='text-xs font-medium text-gray-500'>申请说明</label>
              <p className='text-gray-700 mt-1 whitespace-pre-wrap'>
                {selectedApproval.description}
              </p>
            </div>
            <div>
              <label className='text-xs font-medium text-gray-500'>申请时间</label>
              <p className='text-gray-700 mt-1'>
                {new Date(selectedApproval.created_at).toLocaleString('zh-CN')}
              </p>
            </div>
            {selectedApproval.approve_time && (
              <div>
                <label className='text-xs font-medium text-gray-500'>审批时间</label>
                <p className='text-gray-700 mt-1'>
                  {new Date(selectedApproval.approve_time).toLocaleString('zh-CN')}
                </p>
              </div>
            )}
            {selectedApproval.comment && (
              <div>
                <label className='text-xs font-medium text-gray-500'>审批意见</label>
                <p className='text-gray-700 mt-1'>{selectedApproval.comment}</p>
              </div>
            )}
            {selectedApproval.status === 'pending' && (
              <div className='flex gap-3 pt-4 border-t border-gray-100'>
                <Button
                  variant='outline'
                  onClick={() => handleReject(selectedApproval.id)}
                  className='text-red-600 border-red-200 hover:bg-red-50'
                  disabled={actionLoading}
                >
                  <X className='w-4 h-4' />
                  拒绝申请
                </Button>
                <Button onClick={() => handleApprove(selectedApproval.id)} disabled={actionLoading}>
                  <Check className='w-4 h-4' />
                  通过申请
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Approvals;
