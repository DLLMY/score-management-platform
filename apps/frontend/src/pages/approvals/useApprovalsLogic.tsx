import logger from '../../utils/logger';
/**
 * 审批中心逻辑层（列表加载 + handler + 键盘流 + columns）
 *
 * 展示组件见 ./ApprovalsView；页面装配层见 ../Approvals。
 */

import { formatDateTime } from '../../utils/format';
import { useState, useEffect, useCallback, useMemo, useRef, FormEvent } from 'react';
import { StatusTag, useConfirm, type ColumnType } from '../../components';
import type { ApprovalsViewProps } from './types';
import api from '../../services/api';
import { useListFetch, useStableToast, useTableUrlState } from '../../hooks';

export interface Approval {
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

export interface CreateForm {
  user_id: string;
  title: string;
  description: string;
  type: 'score_adjust' | 'special_reward' | 'other';
  score_change: number;
}

interface FailedBatchItem {
  id: number;
  message: string;
}

export interface FailedBatch {
  action: 'approve' | 'reject';
  comment?: string;
  items: FailedBatchItem[];
}

export function useApprovalsLogic(): ApprovalsViewProps {
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
          : (data as { pagination?: { total?: number } }).pagination?.total ?? approvalsList.length;
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
          if (value === null || value === undefined)
            return <span className='text-gray-400'>-</span>;
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
          <span className='text-sm text-gray-500'>{formatDateTime(value as string)}</span>
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

  // 视图层以 Partial 形式增量更新表单字段，此处收敛为合并语义，避免直接替换丢失其他字段
  const setCreateFormMerged = useCallback(
    (data: Partial<CreateForm>) => setCreateForm((prev) => ({ ...prev, ...data })),
    [setCreateForm]
  );

  return {
    filterStatus,
    setFilterStatus,
    setPage,
    page,
    pageSize,
    sortField,
    sortOrder,
    setSort,
    handlePageChange,
    list,
    loadApprovals,
    columns,
    selectedRowKeys,
    handleSelectionChange,
    activeIndex,
    handleBatchApprove,
    setSelectedRowKeys,
    setShowBatchRejectModal,
    failedBatch,
    handleRetryFailed,
    handleViewDetail,
    handleApprove,
    handleReject,
    showCreateModal,
    setShowCreateModal,
    createForm,
    setCreateForm: setCreateFormMerged,
    handleCreateApproval,
    selectedApproval,
    showDetailModal,
    setShowDetailModal,
    getStatusBadge,
    getTypeLabel,
    showBatchRejectModal,
    rejectComment,
    setRejectComment,
    handleBatchRejectConfirm,
    actionLoading,
  };
}
