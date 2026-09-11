import type { ReactNode } from 'react';
import type { Approval, CreateForm, FailedBatch } from './useApprovalsLogic';
import type { ColumnType, SortOrder } from '../../components';
import type { UseListFetchResult } from '../../hooks';

export interface ApprovalsViewProps {
  // 过滤 / 分页 / 排序
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  setPage: (n: number) => void;
  page: number;
  pageSize: number;
  sortField: string;
  sortOrder: string | null;
  setSort: (field: string, order: SortOrder) => void;
  handlePageChange: (newPage: number, newPageSize: number) => void;

  // 列表
  list: UseListFetchResult<Approval>;
  loadApprovals: () => Promise<void>;
  columns: ColumnType<Approval>[];

  // 选择 / 键盘高亮
  selectedRowKeys: Array<string | number>;
  handleSelectionChange: (keys: Array<string | number>) => void;
  activeIndex: number;
  handleBatchApprove: () => Promise<void>;
  setSelectedRowKeys: (k: Array<string | number>) => void;
  setShowBatchRejectModal: (b: boolean) => void;

  // 批量失败明细
  failedBatch: FailedBatch | null;
  handleRetryFailed: () => void;

  // 行操作
  handleViewDetail: (id: number) => Promise<void>;
  handleApprove: (id: number, comment?: string) => Promise<void>;
  handleReject: (id: number, comment?: string) => Promise<void>;

  // 创建模态
  showCreateModal: boolean;
  setShowCreateModal: (b: boolean) => void;
  createForm: CreateForm;
  setCreateForm: (data: Partial<CreateForm>) => void;
  handleCreateApproval: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;

  // 详情模态
  selectedApproval: Approval | null;
  showDetailModal: boolean;
  setShowDetailModal: (b: boolean) => void;
  getStatusBadge: (status: string) => ReactNode;
  getTypeLabel: (type: string) => string;

  // 批量拒绝模态
  showBatchRejectModal: boolean;
  rejectComment: string;
  setRejectComment: (s: string) => void;
  handleBatchRejectConfirm: () => Promise<void>;

  // 通用
  actionLoading: boolean;
}

/** 常用拒绝理由模板（下拉即选，可再编辑） */
export const REJECT_REASONS: string[] = [
  '请假理由不充分',
  '请假时间与课程冲突',
  '证明材料缺失',
  '申请信息不完整',
  '不符合学校规定',
  '需与家长进一步确认',
];
