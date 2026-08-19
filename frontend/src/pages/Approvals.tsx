import logger from '../utils/logger';
import { useState, useEffect, useCallback, useMemo, useRef, FormEvent, ChangeEvent } from 'react';
import { ClipboardCheck, Check, X, Filter, RefreshCw, Plus } from 'lucide-react';
import { Card, Button, Modal, PermissionButton, DataTable } from '../components';
import type { ColumnType } from '../components/data-display/DataTable';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { useTableUrlState } from '../hooks';
import api from '../services/api';
import { useStableToast } from '../hooks/useStableToast';
import { StudentSelect } from '../components/form/EntitySelect';

interface Approval {
  id: number;
  user_id: number;
  user_name?: string;
  title: string;
  description: string;
  type: 'score_adjust' | 'special_reward' | 'other';
  score_change?: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  approve_time?: string;
  comment?: string;
}

interface CreateForm {
  user_id: string;
  title: string;
  description: string;
  type: 'score_adjust' | 'special_reward' | 'other';
  score_change: number;
}

interface Pagination {
  page: number;
  per_page: number;
  total: number;
}

function Approvals() {
  const { showToast } = useStableToast();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;
  const { page, pageSize, sortField, sortOrder, setPage, setPageSize, setSort } =
    useTableUrlState('approvals');
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>({
    user_id: '',
    title: '',
    description: '',
    type: 'score_adjust',
    score_change: 0,
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, per_page: 20, total: 0 });

  const loadApprovals = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, unknown> = {
        page,
        per_page: pageSize,
      };
      if (filterStatus) params.status = filterStatus;
      if (sortField) {
        params.sort_by = sortField;
        params.sort_order = sortOrder === 'descend' ? 'desc' : 'asc';
      }
      const data = await api.approvals.getAll(params);
      // API返回格式是 { approvals: [...], pagination: { total } }
      const approvalsList = Array.isArray(data)
        ? data
        : (data as { approvals?: Approval[] })?.approvals || [];
      setApprovals(approvalsList);
      // total 用后端 pagination.total（此前用当前页长度冒充导致分页栏隐藏无法翻页）
      setPagination((prev) => ({
        ...prev,
        page,
        per_page: pageSize,
        total:
          (data as { pagination?: { total?: number } }).pagination?.total ?? approvalsList.length,
      }));
    } catch (error) {
      showToast('error', '加载审批失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortField, sortOrder, filterStatus, showToast]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  const handleViewDetail = useCallback(
    async (id: number) => {
      try {
        const data = await api.approvals.getById(id);
        setSelectedApproval(data as Approval);
        setShowDetailModal(true);
    } catch (error) {
      showToast('error', '获取详情失败');
    }
  },
  [showToast]
);

  const handleApprove = useCallback(
    async (id: number, comment = '') => {
      const ok = await confirmRef.current({
        title: '通过申请',
        message: '确定要通过这个申请吗？',
        confirmText: '通过',
        cancelText: '取消',
        type: 'success',
      });
      if (!ok) return;
      try {
        setActionLoading(true);
        await api.approvals.approve(id, { comment });
        setApprovals((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'approved' } : a)));
        setShowDetailModal(false);
        showToast('success', '审批通过');
      } catch (error) {
        logger.error('审批操作失败:', error);
        showToast('error', '操作失败: ' + ((error as Error).message || ''));
    } finally {
      setActionLoading(false);
    }
  },
  [showToast]
);

  const handleReject = useCallback(
    async (id: number, comment = '') => {
      const ok = await confirmRef.current({
        title: '拒绝申请',
        message: '确定要拒绝这个申请吗？',
        confirmText: '拒绝',
        cancelText: '取消',
        type: 'danger',
      });
      if (!ok) return;
      try {
        setActionLoading(true);
        await api.approvals.reject(id, { comment });
        setApprovals((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'rejected' } : a)));
        setShowDetailModal(false);
        showToast('success', '已拒绝');
      } catch (error) {
        logger.error('审批操作失败:', error);
        showToast('error', '操作失败: ' + ((error as Error).message || ''));
    } finally {
      setActionLoading(false);
    }
  },
  [showToast]
);

  const handleCreateApproval = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      try {
        setActionLoading(true);
        const submitData = {
          ...createForm,
          user_id: Number(createForm.user_id),
        };
        await api.approvals.create(submitData);
        setShowCreateModal(false);
        setCreateForm({
          user_id: '',
          title: '',
          description: '',
          type: 'score_adjust',
          score_change: 0,
        });
        // 后端仅返回 {approval_id}，无法本地构建完整对象，重新拉取列表
        loadApprovals();
        showToast('success', '申请创建成功');
      } catch (error) {
        showToast('error', '创建失败');
      } finally {
        setActionLoading(false);
      }
    },
    [createForm, showToast, loadApprovals]
  );

  const getStatusBadge = useMemo(() => {
    return (status: string) => {
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
    return (type: string) => {
      switch (type) {
        case 'score_adjust':
          return '积分调整';
        case 'special_reward':
          return '特殊奖励';
        case 'other':
          return '其他';
        default:
          return '未知类型';
      }
    };
  }, []);

  const columns = useMemo<ColumnType<Approval>[]>(
    () => [
      {
        title: '标题',
        key: 'title',
        dataIndex: 'title',
        width: 200,
        ellipsis: true,
        sorter: true,
      },
      {
        title: '类型',
        key: 'type',
        dataIndex: 'type',
        width: 110,
        render: (value) => (
          <span className='px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium'>
            {getTypeLabel(String(value ?? ''))}
          </span>
        ),
      },
      {
        title: '用户',
        key: 'user_name',
        dataIndex: 'user_name',
        width: 140,
        render: (_, approval) => (
          <span className='text-sm text-gray-700'>
            {approval.user_name || `用户 ${approval.user_id}`}
          </span>
        ),
      },
      {
        title: '积分变化',
        key: 'score_change',
        dataIndex: 'score_change',
        width: 110,
        sorter: true,
        render: (value) => {
          if (value === null || value === undefined) return <span className='text-gray-400'>-</span>;
          const n = Number(value);
          return (
            <span className={`text-sm font-medium ${n >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {n >= 0 ? '+' : ''}
              {n}
            </span>
          );
        },
      },
      {
        title: '状态',
        key: 'status',
        dataIndex: 'status',
        width: 100,
        render: (value) => getStatusBadge(String(value ?? '')),
      },
      {
        title: '申请时间',
        key: 'created_at',
        dataIndex: 'created_at',
        width: 170,
        sorter: true,
        render: (value) => (
          <span className='text-sm text-gray-500'>
            {value ? new Date(value as string).toLocaleString('zh-CN') : '--'}
          </span>
        ),
      },
    ],
    [getTypeLabel, getStatusBadge]
  );

  const handlePageChange = useCallback(
    (newPage: number, newPageSize: number) => {
      setPage(newPage);
      if (newPageSize !== pageSize) setPageSize(newPageSize);
    },
    [pageSize, setPage, setPageSize]
  );

  return (
    <div className='max-w-4xl mx-auto px-4 sm:px-6'>
      <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6'>
        <div className='flex items-center gap-3'>
          <div className='w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30'>
            <ClipboardCheck className='w-5 h-5 sm:w-6 sm:h-6 text-white' />
          </div>
          <div>
            <h2 className='text-lg sm:text-xl font-bold text-gray-900'>审批管理</h2>
            <p className='text-sm text-gray-500'>处理积分调整等申请</p>
          </div>
        </div>
        <Button onClick={() => setShowCreateModal(true)} size='sm'>
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
              onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className='px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
            >
              <option value=''>全部状态</option>
              <option value='pending'>待审批</option>
              <option value='approved'>已通过</option>
              <option value='rejected'>已拒绝</option>
            </select>
          </div>
          <Button variant='outline' onClick={loadApprovals} size='sm'>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>

        <DataTable<Approval>
          columns={columns}
          dataSource={approvals}
          loading={loading}
          rowKey='id'
          total={pagination.total}
          page={pagination.page}
          pageSize={pagination.per_page}
          onPageChange={handlePageChange}
          sortField={sortField || undefined}
          sortOrder={sortOrder}
          onSortChange={(field, order) => setSort(field, order)}
          onRowClick={(approval) => handleViewDetail(approval.id)}
          scroll={{ x: 820 }}
          empty={{ icon: 'file', title: '暂无申请', description: '还没有任何审批申请' }}
          rowActions={(approval) =>
            approval.status === 'pending' ? (
              <div className='flex items-center gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  className='text-green-600 border-green-200 hover:bg-green-50'
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
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
                  size='sm'
                  className='text-red-600 border-red-200 hover:bg-red-50'
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                    handleReject(approval.id);
                  }}
                  disabled={actionLoading}
                >
                  <X className='w-3 h-3' />
                  拒绝
                </Button>
              </div>
            ) : null
          }
        />
      </Card>

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title='创建申请'>
        <form onSubmit={handleCreateApproval} className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>学生</label>
            <StudentSelect
              value={createForm.user_id ? Number(createForm.user_id) : 0}
              onChange={(id) => setCreateForm({ ...createForm, user_id: id ? String(id) : '' })}
              allowEmpty
              emptyLabel='请选择学生'
              className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>申请类型</label>
            <select
              value={createForm.type}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setCreateForm({ ...createForm, type: e.target.value as CreateForm['type'] })
              }
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
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setCreateForm({ ...createForm, title: e.target.value })
              }
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
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
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
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setCreateForm({ ...createForm, description: e.target.value })
              }
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
          size='md'
        >
          <div className='space-y-4'>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div>
                <label className='text-xs font-medium text-gray-500'>申请标题</label>
                <p className='font-medium text-gray-900 text-sm sm:text-base'>
                  {selectedApproval.title}
                </p>
              </div>
              <div>
                <label className='text-xs font-medium text-gray-500'>状态</label>
                <div className='mt-1'>{getStatusBadge(selectedApproval.status)}</div>
              </div>
              <div>
                <label className='text-xs font-medium text-gray-500'>申请类型</label>
                <p className='text-gray-900 text-sm sm:text-base'>
                  {getTypeLabel(selectedApproval.type)}
                </p>
              </div>
              <div>
                <label className='text-xs font-medium text-gray-500'>用户</label>
                <p className='text-gray-900 text-sm sm:text-base'>
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
                {selectedApproval.created_at
                  ? new Date(selectedApproval.created_at).toLocaleString('zh-CN')
                  : '--'}
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
                <PermissionButton
                  permission='score.approve'
                  variant='outline'
                  onClick={() => handleReject(selectedApproval.id)}
                  className='text-red-600 border-red-200 hover:bg-red-50'
                  disabled={actionLoading}
                >
                  <X className='w-4 h-4' />
                  拒绝申请
                </PermissionButton>
                <PermissionButton
                  permission='score.approve'
                  onClick={() => handleApprove(selectedApproval.id)}
                  disabled={actionLoading}
                >
                  <Check className='w-4 h-4' />
                  通过申请
                </PermissionButton>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Approvals;
