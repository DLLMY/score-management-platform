import type { ReactElement } from 'react';
import {
  UserCheck,
  X,
  UserPlus,
  GraduationCap,
  Building2,
  AlertTriangle,
  Check,
} from 'lucide-react';
import type { TeacherPreview } from './types';

interface TeacherPreviewDialogProps {
  isOpen: boolean;
  teacherPreview: TeacherPreview | null;
  isLoading: boolean;
  closeTeacherPreview: () => void;
  confirmAssignHeadTeacher: () => Promise<void>;
}

export default function TeacherPreviewDialog({
  isOpen,
  teacherPreview,
  isLoading,
  closeTeacherPreview,
  confirmAssignHeadTeacher,
}: TeacherPreviewDialogProps): ReactElement {
  if (!isOpen || !teacherPreview) return <></>;
  return (
    <div
      className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4'
      onClick={closeTeacherPreview}
    >
      <div
        className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-800'>
          <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500' />
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center'>
                <UserCheck className='w-5 h-5 text-white' />
              </div>
              <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                确认分配班主任
              </h3>
            </div>
            <button
              onClick={closeTeacherPreview}
              className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
            >
              <X className='w-5 h-5' />
            </button>
          </div>
        </div>

        <div className='px-6 py-6'>
          {/* Preview Content */}
          <div className='space-y-4'>
            <div className='p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl'>
              <div className='flex items-center gap-4'>
                <div className='w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center'>
                  <GraduationCap className='w-7 h-7 text-emerald-600 dark:text-emerald-400' />
                </div>
                <div className='flex-1'>
                  <p className='font-semibold text-slate-900 dark:text-slate-100'>
                    {teacherPreview.teacher.real_name || teacherPreview.teacher.username}
                  </p>
                  <p className='text-sm text-slate-500 dark:text-slate-400'>
                    @{teacherPreview.teacher.username}
                  </p>
                </div>
              </div>
            </div>

            <div className='flex items-center justify-center gap-2 text-slate-400'>
              <div className='w-8 h-0.5 bg-slate-300 dark:bg-slate-600' />
              <UserPlus className='w-5 h-5' />
              <div className='w-8 h-0.5 bg-slate-300 dark:bg-slate-600' />
            </div>

            <div className='p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800'>
              <div className='flex items-center gap-4'>
                <div className='w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center'>
                  <Building2 className='w-7 h-7 text-amber-600 dark:text-amber-400' />
                </div>
                <div className='flex-1'>
                  <p className='font-semibold text-slate-900 dark:text-slate-100'>
                    {teacherPreview.classInfo.name}
                  </p>
                  <p className='text-sm text-slate-500 dark:text-slate-400'>
                    {teacherPreview.classInfo.grade || '未设置年级'}
                  </p>
                </div>
              </div>
            </div>

            {teacherPreview.classInfo.head_teacher_name && (
              <div className='p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800'>
                <div className='flex items-center gap-2 text-red-600 dark:text-red-400'>
                  <AlertTriangle className='w-4 h-4' />
                  <p className='text-sm font-medium'>
                    当前班主任 {teacherPreview.classInfo.head_teacher_name} 将被替换
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-800 flex items-center justify-end gap-3'>
          <button
            onClick={closeTeacherPreview}
            className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
          >
            返回选择
          </button>
          <button
            onClick={confirmAssignHeadTeacher}
            disabled={isLoading}
            className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 font-medium disabled:opacity-50'
          >
            {isLoading ? (
              <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin' />
            ) : (
              <Check className='w-5 h-5' />
            )}
            确认分配
          </button>
        </div>
      </div>
    </div>
  );
}
