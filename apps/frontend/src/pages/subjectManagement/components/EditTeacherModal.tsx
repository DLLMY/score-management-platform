// T12-4 拆分（2026-09-12）：自 SubjectManagementSections.tsx 原样搬出，行为逐字节等价。
import { X, Check, Users } from 'lucide-react';
import { PermissionButton } from '../../../components';
import type { SubjectManagementViewProps } from '../types';

export function EditTeacherModal({
  submitting,
  runSubmit,
  selectedSubject,
  teachers,
  editingTeacherLinkId,
  editingTeacherId,
  setEditingTeacherId,
  handleSaveTeacher,
  closeEditTeacherModal,
}: SubjectManagementViewProps) {
  return (
    <>
      {editingTeacherLinkId > 0 && selectedSubject && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
          onClick={closeEditTeacherModal}
        >
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-white dark:from-slate-800 dark:to-slate-800 flex-shrink-0'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center'>
                    <Users className='w-5 h-5 text-white' />
                  </div>
                  <div>
                    <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                      编辑授课教师
                    </h3>
                    <p className='text-sm text-slate-500 dark:text-slate-400'>
                      {selectedSubject.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeEditTeacherModal}
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <div className='px-6 py-5 space-y-5 flex-1 overflow-y-auto min-h-0'>
              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  选择授课教师
                </label>
                <select
                  value={editingTeacherId}
                  onChange={(e) => setEditingTeacherId(Number(e.target.value))}
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-slate-800 dark:text-slate-100'
                >
                  <option value={0}>不指定教师</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.real_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3 flex-shrink-0'>
              <button
                onClick={closeEditTeacherModal}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                取消
              </button>
              <PermissionButton
                permission='score.entry'
                onClick={() => runSubmit(handleSaveTeacher)}
                disabled={submitting}
                className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed'
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
