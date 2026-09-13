// T12-6 拆分（2026-09-12）：自 CommitteeListView.tsx 原样搬出，行为逐字节等价。
import { History, X, Check } from 'lucide-react';
import type { CommitteeListViewProps } from '../types';

export function TermModal({
  showTermModal,
  setShowTermModal,
  filterClassId,
  terms,
  termsLoading,
  termForm,
  setTermForm,
  handleCreateTerm,
}: CommitteeListViewProps) {
  return (
    <>
      {showTermModal && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
          onClick={() => setShowTermModal(false)}
        >
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-800'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center'>
                    <History className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    班委任期管理
                  </h3>
                </div>
                <button
                  onClick={() => setShowTermModal(false)}
                  aria-label='关闭任期管理弹窗'
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>
            <div className='px-6 py-5 space-y-5 max-h-[60vh] overflow-auto'>
              {!filterClassId ? (
                <p className='text-sm text-amber-600 dark:text-amber-400'>
                  请先在右上角选择一个班级，再进行任期管理
                </p>
              ) : (
                <>
                  <div className='space-y-2'>
                    <p className='text-sm font-semibold text-slate-700 dark:text-slate-300'>
                      现有任期
                    </p>
                    {termsLoading && terms.length === 0 ? (
                      <p className='text-sm text-slate-400 py-2'>加载中...</p>
                    ) : terms.length === 0 ? (
                      <p className='text-sm text-slate-400 dark:text-slate-500 py-2'>
                        暂无任期记录
                      </p>
                    ) : (
                      terms.map((t) => (
                        <div
                          key={t.id}
                          className='flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40'
                        >
                          <div>
                            <p className='text-sm font-medium text-slate-700 dark:text-slate-300'>
                              {t.term_name}
                              {t.is_current && (
                                <span className='ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'>
                                  当前任期
                                </span>
                              )}
                            </p>
                            <p className='text-xs text-slate-500 dark:text-slate-400 mt-0.5'>
                              {t.start_date || '未设置'} ~ {t.end_date || '至今'}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className='border-t border-slate-200/50 dark:border-slate-700/50 pt-4 space-y-4'>
                    <p className='text-sm font-semibold text-slate-700 dark:text-slate-300'>
                      新建任期
                    </p>
                    <div>
                      <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                        任期名称 <span className='text-red-500'>*</span>
                      </label>
                      <input
                        type='text'
                        value={termForm.term_name}
                        onChange={(e) =>
                          setTermForm((prev) => ({ ...prev, term_name: e.target.value }))
                        }
                        placeholder='如：2026-2027学年第一学期'
                        className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-slate-800 dark:text-slate-100'
                      />
                    </div>
                    <div className='grid grid-cols-2 gap-4'>
                      <div>
                        <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                          开始日期
                        </label>
                        <input
                          type='date'
                          value={termForm.start_date}
                          onChange={(e) =>
                            setTermForm((prev) => ({ ...prev, start_date: e.target.value }))
                          }
                          className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-slate-800 dark:text-slate-100'
                        />
                      </div>
                      <div>
                        <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                          结束日期
                        </label>
                        <input
                          type='date'
                          value={termForm.end_date}
                          onChange={(e) =>
                            setTermForm((prev) => ({ ...prev, end_date: e.target.value }))
                          }
                          className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-slate-800 dark:text-slate-100'
                        />
                      </div>
                    </div>
                    <label className='flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer'>
                      <input
                        type='checkbox'
                        checked={termForm.is_current}
                        onChange={(e) =>
                          setTermForm((prev) => ({ ...prev, is_current: e.target.checked }))
                        }
                        className='w-4 h-4 accent-amber-500'
                      />
                      设为当前任期
                    </label>
                  </div>
                </>
              )}
            </div>
            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-800 flex items-center justify-end gap-3'>
              <button
                onClick={() => setShowTermModal(false)}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                关闭
              </button>
              <button
                onClick={handleCreateTerm}
                disabled={termsLoading}
                className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-200 font-medium disabled:opacity-50'
              >
                <Check className='w-5 h-5' />
                创建任期
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
