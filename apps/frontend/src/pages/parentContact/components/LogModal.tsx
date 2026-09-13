// T12-6 拆分（2026-09-12）：自 ParentContactView.tsx 原样搬出，行为逐字节等价。
import { MessageCircle, X, Check } from 'lucide-react';
import { CONTACT_TYPES } from '../constants';
import type { ParentContactViewProps } from '../types';

export function LogModal({
  showLogModal,
  selectedContact,
  setShowLogModal,
  logForm,
  setLogForm,
  runSubmit,
  handleAddLog,
  isLoading,
  submitting,
}: ParentContactViewProps) {
  return (
    <>
      {showLogModal && selectedContact && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
          onClick={() => setShowLogModal(false)}
        >
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-white dark:from-purple-900/20 dark:to-slate-800'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center'>
                    <MessageCircle className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    添加联系日志
                  </h3>
                </div>
                <button
                  onClick={() => setShowLogModal(false)}
                  aria-label='关闭联系日志弹窗'
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
              <p className='text-sm text-slate-500 dark:text-slate-400 mt-2'>
                联系对象: {selectedContact.student_name || `学生${selectedContact.student_id}`}{' '}
                的家长
              </p>
            </div>
            <div className='px-6 py-5 space-y-5'>
              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  联系方式
                </label>
                <select
                  value={logForm.contact_type}
                  onChange={(e) => setLogForm({ ...logForm, contact_type: e.target.value })}
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-slate-800 dark:text-slate-100'
                >
                  {CONTACT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  沟通内容 <span className='text-red-500'>*</span>
                </label>
                <textarea
                  value={logForm.content}
                  onChange={(e) => setLogForm({ ...logForm, content: e.target.value })}
                  placeholder='记录沟通的主要内容...'
                  rows={4}
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-slate-800 dark:text-slate-100 resize-none'
                />
              </div>
            </div>
            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-white dark:from-purple-900/20 dark:to-slate-800 flex items-center justify-end gap-3'>
              <button
                onClick={() => setShowLogModal(false)}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                取消
              </button>
              <button
                onClick={() => runSubmit(handleAddLog)}
                disabled={isLoading || submitting}
                className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-200 font-medium disabled:opacity-50'
              >
                <Check className='w-5 h-5' />
                保存日志
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
