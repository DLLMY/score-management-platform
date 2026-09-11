import { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import {
  Card,
  Button,
  Modal,
  PermissionButton,
  DataTable,
  ImportExportPanel,
} from '../../components';
import { formatDateTime } from '../../utils/format';
import type { User } from '../../types';
import type { ScoreEntryViewProps } from './types';

const {
  Upload,
  CheckCircle,
  Download,
  RefreshCw,
  Save,
  Printer,
  Trash2,
  Filter,
  BarChart3,
  RotateCcw,
} = LucideIcons;

export default function ScoreEntryView(props: ScoreEntryViewProps) {
  const {
    state,
    dispatch,
    setClassInput,
    columns,
    examSubjects,
    visibleSubjects,
    getEntryProgress,
    filteredStudents,
    handleSaveAll,
    handleExport,
    handleImport,
    handleExportErrors,
    handleConfirmAll,
    handleBatchDelete,
    handleBatchReset,
    handleBatchConfirm,
    handlePrint,
    exportTemplate,
    handleRestoreDraft,
    handleDiscardDraft,
    onRefresh,
    onCancelBatch,
    runSubmit,
    submitting,
    draftAvailable,
    batchProgress,
    batchFailures,
    setBatchFailures,
    showImportModal,
    openImportModal,
    closeImportModal,
    showBatchModal,
    openBatchModal,
    closeBatchModal,
    showImportResultModal,
    closeImportResultModal,
  } = props;

  const navigate = useNavigate();
  const selectedExamData = state.exams.find((e) => e.id.toString() === state.selectedExam);

  return (
    <div className='space-y-6'>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { font-size: 12px; }
          table { font-size: 11px; }
          .overflow-x-auto { overflow: visible !important; }
        }
        .print-only { display: none; }
      `}</style>

      {draftAvailable && (
        <div className='flex items-center justify-between gap-3 px-4 py-2.5 mb-4 rounded-lg bg-amber-50 border border-amber-200 text-sm'>
          <span className='text-amber-800'>检测到上次未提交的内容，是否恢复？</span>
          <div className='flex items-center gap-2'>
            <button
              onClick={handleRestoreDraft}
              className='px-3 py-1 rounded-md bg-amber-500 text-white hover:bg-amber-600 text-xs'
            >
              恢复
            </button>
            <button
              onClick={handleDiscardDraft}
              className='px-3 py-1 rounded-md border border-amber-300 text-amber-700 hover:bg-amber-100 text-xs'
            >
              放弃
            </button>
          </div>
        </div>
      )}

      <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>成绩录入</h1>
          <p className='text-gray-500 mt-1'>录入和管理学生考试成绩</p>
        </div>
        <div className='flex flex-wrap gap-2 no-print'>
          <PermissionButton permission='score.view' variant='secondary' onClick={exportTemplate}>
            <Download className='w-4 h-4 mr-2' />
            下载模板
          </PermissionButton>
          <PermissionButton
            permission='score.edit'
            variant='secondary'
            onClick={() => openBatchModal()}
          >
            <Filter className='w-4 h-4 mr-2' />
            批量操作
          </PermissionButton>
          <PermissionButton permission='score.view' variant='secondary' onClick={handlePrint}>
            <Printer className='w-4 h-4 mr-2' />
            打印
          </PermissionButton>
          <ImportExportPanel
            type='score'
            showExport={true}
            showImport={false}
            showTemplate={false}
            onDataExport={handleExport}
            permissions={{
              export: 'score.export',
            }}
          />
          <PermissionButton permission='score.edit' onClick={() => openImportModal()}>
            <Upload className='w-4 h-4 mr-2' />
            导入
          </PermissionButton>
        </div>
      </div>

      <Card>
        <div className='flex flex-wrap gap-4 items-center'>
          <div className='flex-1 min-w-[240px]'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>选择考试 *</label>
            <select
              value={state.selectedExam}
              onChange={(e) => dispatch({ type: 'SET_SELECTED_EXAM', payload: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value=''>请选择考试</option>
              {state.exams.map((exam) => (
                <option key={exam.id} value={exam.id.toString()}>
                  {exam.name}
                </option>
              ))}
            </select>
          </div>
          <div className='w-48'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>筛选班级</label>
            <select
              value={state.selectedClass}
              onChange={(e) => setClassInput(e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value=''>全部班级</option>
              {state.classes.map((cls) => (
                <option key={cls.id} value={String(cls.id)}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
          <div className='w-40'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>筛选科目</label>
            <select
              value={state.filterSubject}
              onChange={(e) => dispatch({ type: 'SET_FILTER_SUBJECT', payload: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value=''>全部科目</option>
              {examSubjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>
          <div className='w-36'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>状态筛选</label>
            <select
              value={state.statusFilter}
              onChange={(e) => dispatch({ type: 'SET_STATUS_FILTER', payload: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value=''>全部</option>
              <option value='empty'>未录入</option>
              <option value='partial'>部分录入</option>
              <option value='pending'>待确认</option>
              <option value='confirmed'>已确认</option>
            </select>
          </div>
          {state.selectedExam && selectedExamData && (
            <div className='text-sm text-gray-500'>
              考试时间: {formatDateTime(selectedExamData.start_time, '-')}
            </div>
          )}
          <PermissionButton permission='score.view' variant='ghost' onClick={onRefresh}>
            <RefreshCw className='w-4 h-4 mr-2' />
            刷新
          </PermissionButton>
        </div>
      </Card>

      {state.selectedExam && (
        <Card>
          <div className='flex items-center justify-between p-4 border-b border-gray-200 no-print'>
            <div className='flex items-center gap-4'>
              <span className='text-sm text-gray-500'>录入进度</span>
              <div className='w-64 h-2 bg-gray-200 rounded-full overflow-hidden'>
                <div
                  className='h-full bg-primary-500 transition-all duration-300'
                  style={{ width: `${getEntryProgress}%` }}
                />
              </div>
              <span className='text-sm font-medium text-gray-700'>{getEntryProgress}%</span>
              {Object.keys(state.pendingChanges).length > 0 && (
                <span className='text-sm text-orange-500'>
                  ({Object.keys(state.pendingChanges).length} 条待保存)
                </span>
              )}
              <span className='hidden xl:inline text-xs text-gray-400'>
                Tab/Enter 跳格 · ↑↓ 切学生 · 粘贴可批量填充
              </span>
            </div>
            <div className='flex gap-2'>
              {getEntryProgress === 100 && (
                <PermissionButton
                  permission='score.view'
                  variant='secondary'
                  onClick={() => {
                    navigate(`/score-analysis?exam_id=${state.selectedExam}`);
                  }}
                >
                  <BarChart3 className='w-4 h-4 mr-2' />
                  查看分析
                </PermissionButton>
              )}
              <PermissionButton
                permission='score.edit'
                variant='secondary'
                onClick={() => runSubmit(handleSaveAll)}
                disabled={submitting || Object.keys(state.pendingChanges).length === 0}
                title={
                  Object.keys(state.pendingChanges).length === 0
                    ? '所有改动已在失焦时自动保存'
                    : '批量保存尚未失焦的待保存改动'
                }
              >
                <Save className='w-4 h-4 mr-2' />
                保存全部
                {Object.keys(state.pendingChanges).length > 0 && (
                  <span className='ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700'>
                    {Object.keys(state.pendingChanges).length}
                  </span>
                )}
              </PermissionButton>
              <PermissionButton
                permission='score.approve'
                variant='primary'
                onClick={handleConfirmAll}
                disabled={!state.selectedExam || state.students.length === 0}
                title={
                  state.students.length === 0
                    ? '请先选择考试'
                    : '将该考试下所有 pending/normal 状态的成绩改为已确认'
                }
              >
                <CheckCircle className='w-4 h-4 mr-2' />
                确认全部
              </PermissionButton>
            </div>
          </div>

          {batchProgress && (
            <div className='flex items-center gap-3 px-4 py-2 mx-4 mt-4 rounded-lg bg-primary-50 border border-primary-200 text-sm'>
              <div className='flex-1'>
                <div className='flex justify-between text-primary-700 mb-1'>
                  <span>
                    正在保存 {batchProgress.processed}/{batchProgress.total} 条
                  </span>
                  <span>
                    预计剩余 {Math.ceil((batchProgress.total - batchProgress.processed) * 0.8)} 秒
                  </span>
                </div>
                <div className='h-1.5 bg-primary-100 rounded-full overflow-hidden'>
                  <div
                    className='h-full bg-primary-500 rounded-full transition-all duration-200'
                    style={{
                      width: `${
                        batchProgress.total
                          ? (batchProgress.processed / batchProgress.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
              <button
                onClick={onCancelBatch}
                className='text-xs text-primary-700 border border-primary-300 rounded px-2 py-1 hover:bg-primary-100'
              >
                取消
              </button>
            </div>
          )}

          {batchFailures && batchFailures.length > 0 && (
            <div className='flex items-start justify-between gap-3 px-4 py-2 mx-4 mt-4 rounded-lg bg-red-50 border border-red-200 text-sm'>
              <div>
                <div className='text-red-700 font-medium mb-1'>
                  {batchFailures.length} 条保存失败（已保留待保存，可重试）：
                </div>
                <ul className='space-y-0.5'>
                  {batchFailures.map((f, index) => (
                    <li key={index} className='text-xs text-red-600'>
                      [{f.key}] {f.error}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => setBatchFailures(null)}
                className='shrink-0 text-xs text-red-400 hover:text-red-600'
              >
                关闭
              </button>
            </div>
          )}

          <DataTable<User>
            columns={columns}
            dataSource={filteredStudents}
            rowKey='id'
            loading={state.loading}
            empty={{
              title: '暂无学生数据',
            }}
            scroll={{ x: 220 + visibleSubjects.length * 100 }}
          />
        </Card>
      )}

      {/* 导入 Modal */}
      <Modal isOpen={showImportModal} onClose={closeImportModal} title='导入成绩'>
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>选择 Excel 文件</label>
            <input
              type='file'
              accept='.xlsx,.xls'
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                dispatch({ type: 'SET_IMPORT_FILE', payload: e.target.files?.[0] || null })
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500'
            />
          </div>
          <div className='text-sm text-gray-500'>
            请确保 Excel 文件格式正确，包含学号、科目、成绩等列。
          </div>
          <div className='flex justify-end gap-2 pt-4'>
            <Button variant='secondary' onClick={closeImportModal}>
              取消
            </Button>
            <PermissionButton
              permission='score.edit'
              onClick={() => runSubmit(handleImport)}
              disabled={submitting || !state.importFile}
            >
              导入
            </PermissionButton>
          </div>
        </div>
      </Modal>

      {/* 批量操作 Modal */}
      <Modal isOpen={showBatchModal} onClose={closeBatchModal} title='批量操作'>
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>选择科目</label>
            <select
              value={state.batchSubject}
              onChange={(e) => dispatch({ type: 'SET_BATCH_SUBJECT', payload: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500'
            >
              <option value=''>请选择科目</option>
              {examSubjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>
          <div className='flex flex-wrap gap-2 pt-4'>
            <PermissionButton
              permission='score.approve'
              variant='secondary'
              onClick={() => runSubmit(handleBatchConfirm)}
              disabled={submitting || !state.batchSubject}
            >
              <CheckCircle className='w-4 h-4 mr-2' />
              批量确认
            </PermissionButton>
            <PermissionButton
              permission='score.edit'
              variant='secondary'
              onClick={() => runSubmit(handleBatchReset)}
              disabled={submitting || !state.batchSubject}
            >
              <RotateCcw className='w-4 h-4 mr-2' />
              批量重置
            </PermissionButton>
            {/* S1: 批量删除与"修改成绩"分离，用 score.delete（teacher 无此权限不能删） */}
            <PermissionButton
              permission='score.delete'
              variant='danger'
              onClick={() => runSubmit(handleBatchDelete)}
              disabled={submitting || !state.batchSubject}
            >
              <Trash2 className='w-4 h-4 mr-2' />
              批量删除
            </PermissionButton>
            {/* M9: 移除占位「复制上次成绩」按钮 */}
          </div>
          <div className='flex justify-end pt-4'>
            <Button onClick={closeBatchModal}>关闭</Button>
          </div>
        </div>
      </Modal>

      {/* 导入结果 Modal */}
      <Modal isOpen={showImportResultModal} onClose={closeImportResultModal} title='导入结果'>
        {state.importResult && (
          <div className='space-y-4'>
            <div className='flex gap-4'>
              <div className='flex-1 p-4 bg-green-50 rounded-lg text-center'>
                <div className='text-2xl font-bold text-green-600'>
                  {state.importResult.successCount}
                </div>
                <div className='text-sm text-green-600'>成功</div>
              </div>
              <div className='flex-1 p-4 bg-red-50 rounded-lg text-center'>
                <div className='text-2xl font-bold text-red-600'>
                  {state.importResult.failedCount}
                </div>
                <div className='text-sm text-red-600'>失败</div>
              </div>
            </div>
            {state.importResult.failedMessages.length > 0 && (
              <div>
                <div className='flex items-center justify-between mb-2'>
                  <h4 className='font-medium text-gray-900'>失败详情</h4>
                  {state.importResult.errors && state.importResult.errors.length > 0 && (
                    <Button size='sm' variant='secondary' onClick={handleExportErrors}>
                      <Download className='w-4 h-4 mr-1' />
                      导出错误数据
                    </Button>
                  )}
                </div>
                <div className='max-h-48 overflow-y-auto bg-gray-50 rounded-lg p-3'>
                  {state.importResult.failedMessages.map((msg, index) => (
                    <div key={index} className='text-sm text-red-600 py-1'>
                      {msg}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className='flex justify-end pt-4'>
              <Button onClick={closeImportResultModal}>关闭</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
