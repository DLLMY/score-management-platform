import type { ReactElement } from 'react';
import {
  UserPlus,
  X,
  Search,
  Users,
  UserCheck,
  GraduationCap,
  Trash2 as RemoveIcon,
} from 'lucide-react';
import { PermissionButton } from '../../components';
import type { ClassInfo } from '../../services/api';
import type { Admin } from '../../types';

interface HeadTeacherModalProps {
  isOpen: boolean;
  selectedClass: ClassInfo | null;
  closeHeadTeacherModal: () => void;
  showRemoveConfirmDialog: () => void;
  searchTeacherTerm: string;
  setSearchTeacherTerm: (value: string) => void;
  filteredTeachers: Admin[];
  showTeacherPreviewDialog: (teacher: Admin) => void;
}

export default function HeadTeacherModal({
  isOpen,
  selectedClass,
  closeHeadTeacherModal,
  showRemoveConfirmDialog,
  searchTeacherTerm,
  setSearchTeacherTerm,
  filteredTeachers,
  showTeacherPreviewDialog,
}: HeadTeacherModalProps): ReactElement {
  if (!isOpen) return <></>;
  return (
    <div
      className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
      onClick={closeHeadTeacherModal}
    >
      <div
        className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-800'>
          <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500' />
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center'>
                <UserPlus className='w-5 h-5 text-white' />
              </div>
              <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                分配班主任 - {selectedClass?.name}
              </h3>
            </div>
            <button
              onClick={closeHeadTeacherModal}
              className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
            >
              <X className='w-5 h-5' />
            </button>
          </div>
        </div>

        <div className='px-6 py-5'>
          {selectedClass?.head_teacher_name && (
            <div className='mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center'>
                    <span className='text-sm font-medium text-white'>
                      {selectedClass.head_teacher_name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <div className='font-medium text-slate-900 dark:text-slate-100'>
                      当前班主任: {selectedClass.head_teacher_name}
                    </div>
                    <div className='text-sm text-slate-500 dark:text-slate-400'>
                      年级: {selectedClass.grade}
                    </div>
                  </div>
                </div>
                <PermissionButton
                  permission='class.manage'
                  onClick={showRemoveConfirmDialog}
                  className='flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 rounded-xl transition-all font-medium text-sm'
                >
                  <RemoveIcon className='w-4 h-4' />
                  移除
                </PermissionButton>
              </div>
            </div>
          )}

          <div>
            <h3 className='text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center'>
              <UserCheck className='w-5 h-5 mr-2 text-amber-500' />
              选择教师
            </h3>
            <div className='relative mb-4'>
              <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400' />
              <input
                type='text'
                value={searchTeacherTerm}
                onChange={(e) => setSearchTeacherTerm(e.target.value)}
                placeholder='搜索教师姓名或用户名...'
                className='w-full pl-12 pr-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all text-sm'
              />
            </div>

            {filteredTeachers.length === 0 ? (
              <div className='text-center py-8 bg-slate-50 dark:bg-slate-700/50 rounded-xl'>
                <div className='w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-200 dark:bg-slate-600 flex items-center justify-center'>
                  <Users className='w-6 h-6 text-slate-400' />
                </div>
                <p className='text-slate-500 dark:text-slate-400'>暂无教师数据</p>
              </div>
            ) : (
              <div className='space-y-2 max-h-[40vh] overflow-y-auto'>
                {filteredTeachers.map((teacher) => (
                  <PermissionButton
                    key={teacher.id}
                    permission='class.manage'
                    onClick={() => showTeacherPreviewDialog(teacher)}
                    className='w-full flex items-center justify-between p-4 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all text-left group'
                  >
                    <div className='flex items-center gap-3'>
                      <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center'>
                        <GraduationCap className='w-5 h-5 text-amber-600 dark:text-amber-400' />
                      </div>
                      <div>
                        <div className='font-medium text-slate-900 dark:text-slate-100'>
                          {teacher.real_name || teacher.username}
                        </div>
                        <div className='text-sm text-slate-500 dark:text-slate-400'>
                          @{teacher.username} | {teacher.phone || '暂无电话'}
                        </div>
                      </div>
                    </div>
                    <div className='flex items-center gap-2'>
                      <span className='text-xs text-slate-500 dark:text-slate-400'>
                        管理{teacher.class_count != null ? teacher.class_count : '--'}个班级
                      </span>
                      <UserPlus className='w-5 h-5 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity' />
                    </div>
                  </PermissionButton>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-800 flex items-center justify-end'>
          <button
            onClick={closeHeadTeacherModal}
            className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
