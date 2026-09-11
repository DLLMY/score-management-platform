import { BookOpen, X, Check } from 'lucide-react';
import { ClassSelect, ToggleSwitch } from '../../components';
import type { GuideFormData, RunSubmit } from './types';

interface GuideModalProps {
  closeGuideModal: () => void;
  guideForm: GuideFormData;
  selectedClassId: number;
  setSelectedClassId: (id: number) => void;
  handleGuideChange: (field: keyof GuideFormData, value: string | boolean) => void;
  guideErrors: Record<string, string>;
  handleGuideSubmit: () => void;
  runSubmit: RunSubmit;
  guideTypes: string[];
  audiences: string[];
  submitting: boolean;
}

export default function GuideModal({
  closeGuideModal,
  guideForm,
  selectedClassId,
  setSelectedClassId,
  handleGuideChange,
  guideErrors,
  handleGuideSubmit,
  runSubmit,
  guideTypes,
  audiences,
  submitting,
}: GuideModalProps) {
  return (
    <div
      className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
      onClick={closeGuideModal}
    >
      <div
        className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-900/20 dark:to-slate-800'>
          <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500' />
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center'>
                <BookOpen className='w-5 h-5 text-white' />
              </div>
              <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                {guideForm.id ? '编辑指导文章' : '创建指导文章'}
              </h3>
            </div>
            <button
              onClick={closeGuideModal}
              aria-label='关闭指导文章弹窗'
              className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
            >
              <X className='w-5 h-5' />
            </button>
          </div>
        </div>

        <div className='px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto'>
          <div>
            <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
              班级 <span className='text-red-500'>*</span>
            </label>
            <ClassSelect
              value={selectedClassId}
              onChange={setSelectedClassId}
              disabled={!!guideForm.id}
              emptyPlaceholder='暂无班级'
            />
            {guideForm.id && <p className='mt-1 text-xs text-slate-400'>编辑时班级不可更改</p>}
          </div>

          <div>
            <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
              标题 <span className='text-red-500'>*</span>
            </label>
            <input
              type='text'
              value={guideForm.title}
              onChange={(e) => handleGuideChange('title', e.target.value)}
              placeholder='输入文章标题'
              className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-800 dark:text-slate-100 ${
                guideErrors.title
                  ? 'border-red-500'
                  : 'border-slate-200 dark:border-slate-600 focus:border-indigo-500'
              }`}
            />
            {guideErrors.title && <p className='mt-1 text-xs text-red-500'>{guideErrors.title}</p>}
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                文章类型
              </label>
              <select
                value={guideForm.guide_type}
                onChange={(e) => handleGuideChange('guide_type', e.target.value)}
                className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-800 dark:text-slate-100'
              >
                {guideTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                适用对象
              </label>
              <select
                value={guideForm.target_audience}
                onChange={(e) => handleGuideChange('target_audience', e.target.value)}
                className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-800 dark:text-slate-100'
              >
                {audiences.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
              文章内容
            </label>
            <textarea
              value={guideForm.content}
              onChange={(e) => handleGuideChange('content', e.target.value)}
              placeholder='输入文章内容'
              rows={5}
              className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none text-slate-800 dark:text-slate-100'
            />
          </div>

          <div className='flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl'>
            <label className='text-sm font-semibold text-slate-700 dark:text-slate-300'>
              发布文章
            </label>
            <ToggleSwitch
              checked={guideForm.is_published}
              onChange={(v) => handleGuideChange('is_published', v)}
              activeClass='bg-gradient-to-r from-indigo-500 to-blue-500'
            />
          </div>
        </div>

        <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3'>
          <button
            onClick={closeGuideModal}
            className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
          >
            取消
          </button>
          <button
            onClick={() => runSubmit(handleGuideSubmit)}
            disabled={submitting}
            className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-xl hover:shadow-lg hover:shadow-indigo-500/25 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed'
          >
            <Check className='w-5 h-5' />
            {submitting ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
