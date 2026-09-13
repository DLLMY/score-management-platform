// T12-6 拆分（2026-09-12）：自 ParentContactView.tsx 原样搬出，行为逐字节等价。
import { Users, X, Check } from 'lucide-react';
import { StudentSelect } from '../../../components';
import type { ParentContactViewProps } from '../types';

export function ContactModal({
  showContactModal,
  setShowContactModal,
  editingContactId,
  contactForm,
  setContactForm,
  runSubmit,
  handleContactSubmit,
  isLoading,
  submitting,
}: ParentContactViewProps) {
  return (
    <>
      {showContactModal && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
          onClick={() => setShowContactModal(false)}
        >
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center'>
                    <Users className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    {editingContactId ? '编辑家长联系方式' : '添加家长联系方式'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowContactModal(false)}
                  aria-label='关闭家长联系方式弹窗'
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>
            <div className='px-6 py-5 space-y-5'>
              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  学生 <span className='text-red-500'>*</span>
                </label>
                <StudentSelect
                  value={contactForm.student_id}
                  onChange={(id) => setContactForm({ ...contactForm, student_id: id })}
                  allowEmpty
                  emptyLabel='请选择学生'
                />
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    父亲姓名
                  </label>
                  <input
                    type='text'
                    value={contactForm.father_name}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, father_name: e.target.value })
                    }
                    placeholder='父亲姓名'
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-slate-100'
                  />
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    父亲电话
                  </label>
                  <input
                    type='tel'
                    value={contactForm.father_phone}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, father_phone: e.target.value })
                    }
                    placeholder='联系电话'
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-slate-100'
                  />
                </div>
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    母亲姓名
                  </label>
                  <input
                    type='text'
                    value={contactForm.mother_name}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, mother_name: e.target.value })
                    }
                    placeholder='母亲姓名'
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-slate-100'
                  />
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    母亲电话
                  </label>
                  <input
                    type='tel'
                    value={contactForm.mother_phone}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, mother_phone: e.target.value })
                    }
                    placeholder='联系电话'
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-slate-100'
                  />
                </div>
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    邮箱
                  </label>
                  <input
                    type='email'
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    placeholder='email@example.com'
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-slate-100'
                  />
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    地址
                  </label>
                  <input
                    type='text'
                    value={contactForm.address}
                    onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })}
                    placeholder='详细地址'
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-slate-100'
                  />
                </div>
              </div>
            </div>
            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3'>
              <button
                onClick={() => setShowContactModal(false)}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                取消
              </button>
              <button
                onClick={() => runSubmit(handleContactSubmit)}
                disabled={isLoading || submitting}
                className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-200 font-medium disabled:opacity-50'
              >
                <Check className='w-5 h-5' />
                {editingContactId ? '保存' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
