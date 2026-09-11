import type React from 'react';
import type { ChangeEvent } from 'react';
import { ClipboardCheck, Check, X, Filter, RefreshCw, Plus, AlertCircle } from 'lucide-react';
import {
  Card,
  Button,
  Modal,
  PermissionButton,
  DataTable,
  StudentSelect,
  type SortOrder,
} from '../../components';
import type { Approval, CreateForm } from './useApprovalsLogic';
import type { ApprovalsViewProps } from './types';
import { REJECT_REASONS } from './types';
import { formatDateTime } from '../../utils/format';

export default function ApprovalsView({
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
  setCreateForm,
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
}: ApprovalsViewProps) {
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
          sortOrder={sortOrder as SortOrder}
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
              onChange={(id) => setCreateForm({ user_id: id ? String(id) : '' })}
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
                setCreateForm({ type: e.target.value as CreateForm['type'] })
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
                setCreateForm({ title: e.target.value })
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
                setCreateForm({ score_change: parseInt(e.target.value) || 0 })
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
                setCreateForm({ description: e.target.value })
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
              <p className='text-gray-700 mt-1'>{formatDateTime(selectedApproval.created_at)}</p>
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
