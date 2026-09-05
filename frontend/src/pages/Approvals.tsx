import logger from '../utils/logger';
import { formatDateTime } from '../utils/format';
import { useState, useEffect, useCallback, useMemo, useRef, FormEvent, ChangeEvent } from 'react';
import { ClipboardCheck, Check, X, Filter, RefreshCw, Plus, AlertCircle } from 'lucide-react';
import { Card, Button, Modal, PermissionButton, DataTable, StatusTag } from '../components';
import type { ColumnType } from '../components/data-display/DataTable';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { useTableUrlState } from '../hooks';
import api from '../services/api';
import { useStableToast } from '../hooks/useStableToast';
import { useListFetch } from '../hooks';
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

/** 常用拒绝理由模板（下拉即选，可再编辑） */
const REJECT_REASONS = [
  '请假理由不充分',
  '请假时间与课程冲突',
  '证明材料缺失',
  '申请信息不完整',
  '不符合学校规定',
  '需与家长进一步确认',
];

interface FailedBatchItem {
  id: number;
  message: string;
}

interface FailedBatch {
  action: 'approve' | 'reject';
  comment?: string;
  items: FailedBatchItem[];
}

function Approvals() {
  const { showToast } = useStableToast();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;
  const { page, pageSize, sortField, sortOrder, setPage, setPageSize, setSort } =
    useTableUrlState('approvals');
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
  const [selectedRowKeys, setSelectedRowKeys] = useState<Array<string | number>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showBatchRejectModal, setShowBatchRejectModal] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [failedBatch, setFailedBatch] = useState<FailedBatch | null>(null);

  // A 轨：审批列表迁 useListFetch（分页/排序/状态过滤声明式进 params，abort 竞态内建）
  const list = useListFetch<Approval>({
    params: {
      page,
      pageSize,
      status: filterStatus || undefined,
      sortBy: sortField || undefined,
      sortOrd: sortOrder ?? undefined,
    },
    fetcher: async ({ page: pg, pageSize: size, status, sortBy, sortOrd }) => {
      const params: Record<string, unknown> = { page: pg, per_page: size };
      const st = status as string | undefined;
      if (st) params.status = st;
      const sf = sortBy as string | undefined;
      if (sf) {
        params.sort_by = sf;
        params.sort_order = sortOrd === 'descend' ? 'desc' : 'asc';
      }
      try {
        const data = await api.approvals.getAll(params);
        // API返回格式是 { approvals: [...], pagination: { total } }
        const approvalsList = Array.isArray(data)
          ? data
          : (data as { approvals?: Approval[] })?.approvals || [];
        // total 用后端 pagination.total（此前用当前页长度冒充导致分页栏隐藏无法翻页）
        const total = Array.isArray(data)
          ? approvalsList.length
          : ((data as { pagination?: { total?: number } }).pagination?.total ??
            approvalsList.length);
        return { items: approvalsList, total };
      } catch (error) {
        showToast('error', '加载审批失败');
        throw error;
      }
    },
  });
  // 既有按钮/批量回退路径仍以 loadApprovals 命名调用（语义 = 重新拉取当前页）
  const loadApprovals = useCallback(async (): Promise<void> => {
    await list.refetch();
  }, [list]);

  // 列表变化后收敛 activeIndex，避免越界
  useEffect(() => {
    if (list.items.length > 0 && activeIndex >= list.items.length) {
      setActiveIndex(list.items.length - 1);
    }
  }, [list.items.length, activeIndex]);

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
        list.mutate({
          items: list.items.map((a) => (a.id === id ? { ...a, status: 'approved' } : a)),
        });
        setShowDetailModal(false);
        showToast('success', '审批通过');
      } catch (error) {
        logger.error('审批操作失败:', error);
        showToast('error', '操作失败: ' + ((error as Error).message || ''));
    } finally {
      setActionLoading(false);
    }
  },
  [showToast, list]
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
        list.mutate({
          items: list.items.map((a) => (a.id === id ? { ...a, status: 'rejected' } : a)),
        });
        setShowDetailModal(false);
        showToast('success', '已拒绝');
      } catch (error) {
        logger.error('审批操作失败:', error);
        showToast('error', '操作失败: ' + ((error as Error).message || ''));
    } finally {
      setActionLoading(false);
    }
  },
  [showToast, list]
);

  /** 批量通过/拒绝的公共执行逻辑，含失败明细与重试数据维护 */
  const processBatch = useCallback(
    async (action: 'approve' | 'reject', ids: number[], comment?: string) => {
      if (ids.length === 0) return;
      try {
        setActionLoading(true);
        const res =
          action === 'approve'
            ? await api.approvals.batchApprove(ids)
            : await api.approvals.batchReject(ids, comment);
        const failedItems = res.results
          .filter((r) => !r.success)
          .map((r) => ({ id: r.id, message: r.message }));
        setFailedBatch(failedItems.length > 0 ? { action, comment, items: failedItems } : null);
        showToast(
          res.failed_count > 0 ? 'warning' : 'success',
          `成功 ${res.success_count} 条，失败 ${res.failed_count} 条`
        );
        await loadApprovals();
        setSelectedRowKeys([]);
        setActiveIndex(0);
      } catch (error) {
        logger.error('批量审批失败:', error);
        showToast('error', '操作失败: ' + ((error as Error).message || ''));
      } finally {
        setActionLoading(false);
      }
    },
    [loadApprovals, showToast]
  );

  const handleBatchApprove = useCallback(async () => {
    const ids = selectedRowKeys.map(Number).filter((n) => !Number.isNaN(n));
    if (ids.length === 0) return;
    const ok = await confirmRef.current({
      title: '批量通过',
      message: `确定批量通过选中的 ${ids.length} 条申请吗？`,
      confirmText: '通过',
      cancelText: '取消',
      type: 'success',
    });
    if (!ok) return;
    await processBatch('approve', ids);
  }, [selectedRowKeys, processBatch]);

  const handleBatchRejectConfirm = useCallback(async () => {
    if (rejectComment.trim() === '') {
      showToast('warning', '拒绝理由不能为空');
      return;
    }
    const ids = selectedRowKeys.map(Number).filter((n) => !Number.isNaN(n));
    setShowBatchRejectModal(false);
    await processBatch('reject', ids, rejectComment.trim());
  }, [rejectComment, selectedRowKeys, processBatch, showToast]);

  /** 重试失败项：对失败 id 集合重新执行同类型批量操作 */
  const handleRetryFailed = useCallback(() => {
    if (!failedBatch || failedBatch.items.length === 0) return;
    const ids = failedBatch.items.map((i) => i.id);
    setShowBatchRejectModal(false);
    processBatch(failedBatch.action, ids, failedBatch.comment);
  }, [failedBatch, processBatch]);

  const handleSelectionChange = useCallback((keys: Array<string | number>) => {
    setSelectedRowKeys(keys);
  }, []);

  // 键盘流：J/K 移动，Y 通过，N 拒绝（输入框聚焦时不生效）
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
        return;
      }
      if (list.items.length === 0) return;
      const key = e.key;
      if (key === 'j' || key === 'J') {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, list.items.length - 1));
      } else if (key === 'k' || key === 'K') {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (key === 'y' || key === 'Y') {
        const item = list.items[activeIndex];
        if (item && item.status === 'pending') handleApprove(item.id);
      } else if (key === 'n' || key === 'N') {
        const item = list.items[activeIndex];
        if (item && item.status === 'pending') handleReject(item.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [list.items, activeIndex, handleApprove, handleReject]);

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
          return <StatusTag tone='warning' label='待审批' />;
        case 'approved':
          return <StatusTag tone='success' label='已通过' />;
        case 'rejected':
          return <StatusTag tone='danger' label='已拒绝' />;
        default:
          return <StatusTag tone='neutral' label={status} />;
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
            {formatDateTime(value as string)}
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
            <RefreshCw className={`w-4 h-4 ${list.loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          {selectedRowKeys.length > 0 && (
            <div className='flex items-center gap-2'>
              <Button
                variant='primary'
                size='sm'
                onClick={handleBatchApprove}
                disabled={actionLoading}
              >
                <Check className='w-3 h-3' />
                批量通过({selectedRowKeys.length})
              </Button>
              <Button
                variant='danger'
                size='sm'
                onClick={() => setShowBatchRejectModal(true)}
                disabled={actionLoading}
              >
                <X className='w-3 h-3' />
                批量拒绝({selectedRowKeys.length})
              </Button>
              <Button variant='outline' size='sm' onClick={() => setSelectedRowKeys([])}>
                清空选择
              </Button>
            </div>
          )}
          <span className='ml-auto text-xs text-gray-400'>键盘：J/K 移动 · Y 通过 · N 拒绝</span>
        </div>

        {failedBatch && failedBatch.items.length > 0 && (
          <div className='mb-4 rounded-lg border border-red-200 bg-red-50 p-3'>
            <div className='flex items-center justify-between mb-2'>
              <span className='text-sm font-medium text-red-700'>
                <AlertCircle className='w-4 h-4 inline mr-1 -mt-0.5' />
                以下 {failedBatch.items.length} 条申请操作失败
              </span>
              <Button
                variant='outline'
                size='sm'
                className='text-red-600 border-red-200 hover:bg-red-100'
                onClick={handleRetryFailed}
                disabled={actionLoading}
              >
                <RefreshCw className='w-3 h-3' />
                重试失败项
              </Button>
            </div>
            <ul className='space-y-1 max-h-40 overflow-y-auto'>
              {failedBatch.items.map((item) => (
                <li key={item.id} className='flex items-start gap-1.5 text-xs text-red-600'>
                  <span className='font-medium whitespace-nowrap'>#{item.id}</span>
                  <span>{item.message || '操作失败'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DataTable<Approval>
          columns={columns}
          dataSource={list.items}
          loading={list.loading}
          rowKey='id'
          selectable
          selectedRowKeys={selectedRowKeys}
          onSelectChange={handleSelectionChange}
          rowClassName={(_, index) => (index === activeIndex ? 'bg-primary-50' : '')}
          total={list.total}
          page={page}
          pageSize={pageSize}
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
                {formatDateTime(selectedApproval.created_at)}
              </p>
            </div>
            {selectedApproval.approve_time && (
              <div>
                <label className='text-xs font-medium text-gray-500'>审批时间</label>
                <p className='text-gray-700 mt-1'>
                  {formatDateTime(selectedApproval.approve_time)}
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

      <Modal
        isOpen={showBatchRejectModal}
        onClose={() => setShowBatchRejectModal(false)}
        title='批量拒绝'
        size='md'
      >
        <div className='space-y-4'>
          <p className='text-sm text-gray-600'>
            将对选中的 {selectedRowKeys.length} 条申请执行拒绝操作，请填写拒绝理由。
          </p>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>常用拒绝理由</label>
            <select
              value={rejectComment}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setRejectComment(e.target.value)}
              className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
            >
              <option value=''>请选择或手动输入</option>
              {REJECT_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              拒绝理由 <span className='text-red-500'>*</span>
            </label>
            <textarea
              value={rejectComment}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setRejectComment(e.target.value)}
              className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[100px]'
              placeholder='请输入拒绝理由'
            />
            {rejectComment.trim() === '' && (
              <p className='text-xs text-red-500 mt-1'>拒绝理由不能为空</p>
            )}
          </div>
          <div className='flex gap-3 pt-4 border-t border-gray-100'>
            <Button
              variant='outline'
              onClick={() => setShowBatchRejectModal(false)}
              disabled={actionLoading}
            >
              取消
            </Button>
            <Button
              variant='danger'
              onClick={handleBatchRejectConfirm}
              disabled={actionLoading || rejectComment.trim() === ''}
            >
              <X className='w-4 h-4' />
              确认拒绝
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default Approvals;
