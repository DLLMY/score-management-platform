import React from 'react';
/**
 * 班主任评语页视图层。
 *
 * 承接原 TeacherComments.tsx 的主渲染 JSX，全部数据经
 * TeacherCommentsViewProps 注入，不含任何数据获取逻辑。
 */

import { Pagination } from 'antd';
import { MessageSquareQuote, Plus, Edit2, Trash2, X, Check, Star, Search } from 'lucide-react';
import {
  DataTable,
  CurrentClassLabel,
  WorkbenchBreadcrumb,
  ClassSelect,
  StudentSelect,
} from '../../components';
import type { TeacherComment } from '../../types';
import { COMMENT_TYPES } from './types';
import type { TeacherCommentsViewProps } from './types';

const TeacherCommentsView: React.FC<TeacherCommentsViewProps> = ({
  columns,
  commentPage,
  setCommentPage,
  commentTotal,
  comments,
  filteredComments,
  isLoading,
  searchTerm,
  setSearchTerm,
  filterClassId,
  setFilterClassId,
  showModal,
  editingId,
  formData,
  setFormData,
  errors,
  isSubmitting,
  openCreateModal,
  openEditModal,
  handleCloseModal,
  handleSubmit,
  runSubmit,
  handleDelete,
}) => {
  return (
    <div className='flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
      <div className='px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20'>
              <MessageSquareQuote className='w-6 h-6 text-white' />
            </div>
            <div>
              <h1 className='text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text'>
                评语管理
              </h1>
              <p className='text-sm text-slate-500 dark:text-slate-400'>
                按学生记录阶段性评价与寄语，支持学期/月度/自定义类型
              </p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <div className='w-44'>
              <ClassSelect
                allowEmpty
                emptyLabel='全部班级'
                value={filterClassId}
                onChange={setFilterClassId}
              />
            </div>
            <WorkbenchBreadcrumb current='评语管理' />
            <CurrentClassLabel />
            <button
              onClick={openCreateModal}
              className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
            >
              <Plus className='w-5 h-5' />
              添加评语
            </button>
          </div>
        </div>
      </div>

      <div className='flex-1 px-6 py-5 overflow-auto'>
        <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden'>
          <div className='px-5 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-slate-50/50 to-white/50 dark:from-slate-800/50 dark:to-slate-800'>
            <div className='flex items-center gap-4'>
              <div className='relative flex-1 max-w-md'>
                <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400' />
                <input
                  type='text'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder='搜索学生、内容或周期...'
                  aria-label='搜索评语'
                  className='w-full pl-12 pr-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-sm'
                />
              </div>
            </div>
          </div>

          <DataTable<TeacherComment>
            columns={columns}
            dataSource={filteredComments}
            loading={isLoading && comments.length === 0}
            rowKey='id'
            rowClassName={() => 'group'}
            empty={{
              icon: 'file',
              title: filterClassId > 0 ? '该班级暂无评语记录' : '暂无评语记录',
              actionLabel: '添加第一条评语',
              onAction: openCreateModal,
            }}
            scroll={{ x: 900 }}
            rowActions={(item) => (
              <div className='flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity'>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal(item);
                  }}
                  aria-label='编辑评语'
                  className='p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-all'
                >
                  <Edit2 className='w-4 h-4' />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(item.id);
                  }}
                  aria-label='删除评语'
                  className='p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all'
                >
                  <Trash2 className='w-4 h-4' />
                </button>
              </div>
            )}
          />
        </div>
        {commentTotal > 50 && (
          <div className='mt-5 flex justify-center'>
            <Pagination
              current={commentPage}
              total={commentTotal}
              pageSize={50}
              onChange={(p) => setCommentPage(p)}
              showSizeChanger={false}
            />
          </div>
        )}
      </div>

      {showModal && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
          onClick={handleCloseModal}
        >
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-800'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center'>
                    <MessageSquareQuote className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    {editingId ? '编辑评语' : '添加评语'}
                  </h3>
                </div>
                <button
                  onClick={handleCloseModal}
                  aria-label='关闭评语弹窗'
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <div className='px-6 py-5 space-y-5'>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    学生 <span className='text-red-500'>*</span>
                  </label>
                  <StudentSelect
                    value={formData.student_id}
                    onChange={(id) => setFormData((prev) => ({ ...prev, student_id: id }))}
                    allowEmpty
                    emptyLabel='请选择学生'
                    className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-slate-800 dark:text-slate-100 ${
                      errors.student_id
                        ? 'border-red-500'
                        : 'border-slate-200 dark:border-slate-600 focus:border-emerald-500'
                    }`}
                  />
                  {errors.student_id && (
                    <p className='mt-1 text-xs text-red-500'>{errors.student_id}</p>
                  )}
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    类型
                  </label>
                  <select
                    value={formData.comment_type}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, comment_type: e.target.value }))
                    }
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-800 dark:text-slate-100'
                  >
                    {COMMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    周期/学期
                  </label>
                  <input
                    type='text'
                    value={formData.term}
                    onChange={(e) => setFormData((prev) => ({ ...prev, term: e.target.value }))}
                    placeholder='如：2026学年第一学期'
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-slate-800 dark:text-slate-100'
                  />
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    评分（1-5 星，可选）
                  </label>
                  <div className='flex items-center gap-1 pt-2'>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type='button'
                        aria-label={`设置评分 ${n} 星`}
                        onClick={() => setFormData((prev) => ({ ...prev, rating: n }))}
                        className='focus:outline-none'
                      >
                        <Star
                          className={`w-6 h-6 transition-colors ${
                            n <= formData.rating
                              ? 'text-amber-500 fill-amber-500'
                              : 'text-slate-300 dark:text-slate-600 hover:text-amber-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  评语内容 <span className='text-red-500'>*</span>
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
                  placeholder='记录对学生的阶段性评价、寄语...'
                  rows={4}
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all resize-none text-slate-800 dark:text-slate-100 placeholder-slate-400 ${
                    errors.content
                      ? 'border-red-500'
                      : 'border-slate-200 dark:border-slate-600 focus:border-emerald-500'
                  }`}
                />
                {errors.content && <p className='mt-1 text-xs text-red-500'>{errors.content}</p>}
              </div>
            </div>

            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-800 flex items-center justify-end gap-3'>
              <button
                onClick={handleCloseModal}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                取消
              </button>
              <button
                onClick={() => runSubmit(handleSubmit)}
                disabled={isLoading || isSubmitting}
                className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 font-medium disabled:opacity-50'
              >
                <Check className='w-5 h-5' />
                {editingId ? '保存' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherCommentsView;
