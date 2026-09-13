// T12-4 拆分（2026-09-12）：自 SubjectManagementSections.tsx 原样搬出，行为逐字节等价。
import { X, Check, Palette } from 'lucide-react';
import { PermissionButton, ToggleSwitch } from '../../../components';
import { presetColors } from '../constants';
import type { SubjectManagementViewProps } from '../types';

export function SubjectFormModal({
  showModal,
  formData,
  errors,
  handleChange,
  handleChangeEvent,
  handleCloseModal,
  submitting,
  runSubmit,
  validateAll,
  onSubmit,
}: SubjectManagementViewProps) {
  return (
    <>
      {showModal && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
          onClick={handleCloseModal}
        >
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex-shrink-0'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center'>
                    <Palette className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    {formData.id ? '编辑科目' : '添加科目'}
                  </h3>
                </div>
                <button
                  onClick={handleCloseModal}
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <form
              onSubmit={(e) => e.preventDefault()}
              className='px-6 py-5 space-y-5 flex-1 overflow-y-auto min-h-0'
            >
              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  科目名称 <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  value={formData.name}
                  onChange={handleChangeEvent('name')}
                  placeholder='输入科目名称'
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400 ${
                    errors.name
                      ? 'border-red-500'
                      : 'border-slate-200 dark:border-slate-600 focus:border-violet-500'
                  }`}
                />
                {errors.name && <p className='mt-1 text-sm text-red-500'>{errors.name}</p>}
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    科目代码
                  </label>
                  <input
                    type='text'
                    value={formData.code}
                    onChange={handleChangeEvent('code')}
                    placeholder='如: MATH'
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400'
                  />
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    所属年级
                  </label>
                  <input
                    type='text'
                    value={formData.grade}
                    onChange={handleChangeEvent('grade')}
                    placeholder='如: 高一'
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400'
                  />
                </div>
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  颜色
                </label>
                <div className='flex items-center gap-3 mb-3'>
                  <input
                    type='color'
                    value={formData.color}
                    onChange={handleChangeEvent('color')}
                    className='w-12 h-10 rounded-xl cursor-pointer border-0 bg-transparent'
                  />
                  <input
                    type='text'
                    value={formData.color}
                    onChange={handleChangeEvent('color')}
                    className='flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all text-slate-800 dark:text-slate-100'
                  />
                </div>
                <div className='flex flex-wrap gap-2'>
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      type='button'
                      onClick={() => handleChange('color', color)}
                      className={`w-8 h-8 rounded-lg transition-all hover:scale-110 ${
                        formData.color === color
                          ? 'ring-2 ring-offset-2 ring-violet-500 scale-110'
                          : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={handleChangeEvent('description')}
                  placeholder='输入科目描述'
                  rows={3}
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all resize-none text-slate-800 dark:text-slate-100 placeholder-slate-400'
                />
              </div>

              <div className='flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl'>
                <label className='text-sm font-semibold text-slate-700 dark:text-slate-300'>
                  启用状态
                </label>
                <ToggleSwitch
                  checked={formData.is_active}
                  onChange={(v) => handleChange('is_active', v)}
                  activeClass='bg-gradient-to-r from-emerald-500 to-teal-500'
                />
              </div>
            </form>

            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3 flex-shrink-0'>
              <button
                onClick={handleCloseModal}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                取消
              </button>
              <PermissionButton
                permission='score.entry'
                onClick={() =>
                  runSubmit(async () => {
                    const isValid = validateAll();
                    if (!isValid) return;
                    await onSubmit(formData);
                  })
                }
                disabled={submitting}
                className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed'
              >
                <Check className='w-5 h-5' />
                {submitting ? '保存中...' : '保存'}
              </PermissionButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
