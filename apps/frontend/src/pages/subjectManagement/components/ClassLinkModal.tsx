// T12-4 拆分（2026-09-12）：自 SubjectManagementSections.tsx 原样搬出，行为逐字节等价。
import { Plus, Edit2, X, Link2, Users, Minus, School } from 'lucide-react';
import { PermissionButton } from '../../../components';
import type { SubjectManagementViewProps } from '../types';

export function ClassLinkModal({
  submitting,
  runSubmit,
  showClassLinkModal,
  closeClassLinkModal,
  selectedSubject,
  subjectClasses,
  allClasses,
  teachers,
  selectedClassId,
  setSelectedClassId,
  selectedTeacherId,
  setSelectedTeacherId,
  linkLoading,
  handleAssignClass,
  handleEditTeacher,
  handleRemoveClass,
}: SubjectManagementViewProps) {
  return (
    <>
      {showClassLinkModal && selectedSubject && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
          onClick={closeClassLinkModal}
        >
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-white dark:from-slate-800 dark:to-slate-800 flex-shrink-0'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center'>
                    <Link2 className='w-5 h-5 text-white' />
                  </div>
                  <div>
                    <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                      关联班级
                    </h3>
                    <p className='text-sm text-slate-500 dark:text-slate-400'>
                      {selectedSubject.name} - 已关联 {subjectClasses.length} 个班级
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeClassLinkModal}
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <div className='px-6 py-5 space-y-5 flex-1 overflow-y-auto min-h-0'>
              {/* Add new class link */}
              <div className='bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-4 space-y-4'>
                <h4 className='text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2'>
                  <Plus className='w-4 h-4' />
                  添加班级关联
                </h4>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
                  <div>
                    <label className='block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5'>
                      选择班级
                    </label>
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(Number(e.target.value))}
                      className='w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm text-slate-800 dark:text-slate-100'
                    >
                      <option value={0}>请选择班级</option>
                      {allClasses
                        .filter((c) => !subjectClasses.some((sc) => sc.class_info_id === c.id))
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.grade ? `(${c.grade})` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className='block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5'>
                      授课教师（可选）
                    </label>
                    <select
                      value={selectedTeacherId}
                      onChange={(e) => setSelectedTeacherId(Number(e.target.value))}
                      className='w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm text-slate-800 dark:text-slate-100'
                    >
                      <option value={0}>不指定</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.real_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className='flex items-end'>
                    <PermissionButton
                      permission='score.entry'
                      onClick={() => runSubmit(handleAssignClass)}
                      disabled={submitting}
                      className='w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 font-medium text-sm disabled:opacity-50'
                    >
                      <Plus className='w-4 h-4' />
                      添加关联
                    </PermissionButton>
                  </div>
                </div>
              </div>

              {/* Linked classes list */}
              <div>
                <h4 className='text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2'>
                  <School className='w-4 h-4' />
                  已关联班级
                </h4>
                {linkLoading ? (
                  <div className='flex items-center justify-center py-8'>
                    <div className='w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin' />
                  </div>
                ) : subjectClasses.length === 0 ? (
                  <div className='text-center py-8 bg-slate-50 dark:bg-slate-700/30 rounded-2xl'>
                    <School className='w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2' />
                    <p className='text-sm text-slate-400 dark:text-slate-500'>暂无关联班级</p>
                  </div>
                ) : (
                  <div className='space-y-2'>
                    {subjectClasses.map((sc) => (
                      <div
                        key={sc.id}
                        className='flex items-center justify-between p-4 bg-white dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600/50 hover:shadow-md transition-all'
                      >
                        <div className='flex items-center gap-3'>
                          <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center'>
                            <School className='w-5 h-5 text-white' />
                          </div>
                          <div>
                            <p className='font-semibold text-slate-800 dark:text-slate-100 text-sm'>
                              {sc.class_name}
                            </p>
                            {sc.grade && (
                              <p className='text-xs text-slate-500 dark:text-slate-400'>
                                {sc.grade}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className='flex items-center gap-2'>
                          {sc.teacher_name ? (
                            <div className='flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-600 px-2.5 py-1 rounded-full'>
                              <Users className='w-3 h-3' />
                              {sc.teacher_name}
                            </div>
                          ) : (
                            <span className='text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700/50 px-2.5 py-1 rounded-full'>
                              未指定教师
                            </span>
                          )}
                          <PermissionButton
                            permission='score.entry'
                            onClick={() => handleEditTeacher(sc)}
                            className='p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all'
                            title='编辑教师'
                          >
                            <Edit2 className='w-4 h-4' />
                          </PermissionButton>
                          <PermissionButton
                            permission='score.entry'
                            onClick={() => handleRemoveClass(sc.class_info_id)}
                            className='p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all'
                            title='移除关联'
                          >
                            <Minus className='w-4 h-4' />
                          </PermissionButton>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
