import type { ReactElement } from 'react';
import { BookOpen, X, Check } from 'lucide-react';
import { ToggleSwitch } from '../../components';
import type { FormData } from './types';
import type { FormErrors } from '../../hooks';

interface ClassFormModalProps {
  isOpen: boolean;
  formData: FormData;
  errors: FormErrors<FormData>;
  handleChangeEvent: <K extends keyof FormData>(
    field: K
  ) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleChange: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  closeModal: () => void;
  validateAll: () => boolean;
  onSubmit: (data: FormData) => Promise<void>;
}

export default function ClassFormModal({
  isOpen,
  formData,
  errors,
  handleChangeEvent,
  handleChange,
  closeModal,
  validateAll,
  onSubmit,
}: ClassFormModalProps): ReactElement {
  if (!isOpen) return <></>;
  return (
    <div
      className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
      onClick={closeModal}
    >
      <div
        className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800'>
          <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500' />
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center'>
                <BookOpen className='w-5 h-5 text-white' />
              </div>
              <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                {formData.id ? '编辑班级' : '添加班级'}
              </h3>
            </div>
            <button
              onClick={closeModal}
              className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
            >
              <X className='w-5 h-5' />
            </button>
          </div>
        </div>

        <div className='px-6 py-5 space-y-5'>
          <div>
            <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
              班级名称 <span className='text-red-500'>*</span>
            </label>
            <input
              type='text'
              name='name'
              value={formData.name}
              onChange={handleChangeEvent('name')}
              placeholder='输入班级名称'
              className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400 ${
                errors.name
                  ? 'border-red-500'
                  : 'border-slate-200 dark:border-slate-600 focus:border-blue-500'
              }`}
            />
            {errors.name && <p className='mt-1 text-xs text-red-500'>{errors.name}</p>}
          </div>

          <div>
            <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
              年级
            </label>
            <input
              type='text'
              name='grade'
              value={formData.grade}
              onChange={handleChangeEvent('grade')}
              placeholder='输入年级（如：高一）'
              className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400 ${
                errors.grade
                  ? 'border-red-500'
                  : 'border-slate-200 dark:border-slate-600 focus:border-blue-500'
              }`}
            />
            {errors.grade && <p className='mt-1 text-xs text-red-500'>{errors.grade}</p>}
          </div>

          <div>
            <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
              描述
            </label>
            <textarea
              name='description'
              value={formData.description}
              onChange={handleChangeEvent('description')}
              placeholder='输入班级描述'
              rows={3}
              className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none text-slate-800 dark:text-slate-100 placeholder-slate-400 ${
                errors.description
                  ? 'border-red-500'
                  : 'border-slate-200 dark:border-slate-600 focus:border-blue-500'
              }`}
            />
            {errors.description && (
              <p className='mt-1 text-xs text-red-500'>{errors.description}</p>
            )}
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
        </div>

        <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3'>
          <button
            onClick={closeModal}
            className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
          >
            取消
          </button>
          <button
            onClick={async () => {
              const isValid = validateAll();
              if (!isValid) return;
              await onSubmit(formData);
            }}
            className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 font-medium'
          >
            <Check className='w-5 h-5' />
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
