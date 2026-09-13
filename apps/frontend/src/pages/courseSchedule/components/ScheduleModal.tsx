// T12-4 拆分（2026-09-12）：自 CourseScheduleView.tsx 原样搬出，行为逐字节等价。
import { Calendar, X, Check, User, MapPin, AlertTriangle } from 'lucide-react';
import { PermissionButton } from '../../../components';
import type { CourseScheduleViewProps } from '../types';

export function ScheduleModal({
  classes,
  activePeriods,
  showModal,
  closeModal,
  editingSchedule,
  setEditingSchedule,
  conflictResult,
  setConflictResult,
  formData,
  handleFormChange,
  handleSubjectChange,
  subjects,
  weekDays,
  getPeriodTime,
  teachers,
  checkConflicts,
  submitting,
  handleSubmit,
  runSubmit,
}: CourseScheduleViewProps) {
  return (
    <>
      {showModal && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
          onClick={() => {
            closeModal();
            setEditingSchedule(null);
            setConflictResult(null);
          }}
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
                    <Calendar className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    {editingSchedule ? '编辑课程安排' : '添加课程安排'}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    closeModal();
                    setEditingSchedule(null);
                    setConflictResult(null);
                  }}
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void runSubmit(handleSubmit);
              }}
              className='px-6 py-5 space-y-5'
            >
              {/* Conflict Warning */}
              {conflictResult?.has_conflict && (
                <div className='p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl'>
                  <div className='flex items-start gap-3'>
                    <AlertTriangle className='w-5 h-5 text-red-500 mt-0.5' />
                    <div>
                      <p className='font-medium text-red-600 dark:text-red-400'>检测到冲突</p>
                      <ul className='mt-2 text-sm text-red-500 dark:text-red-400 space-y-1'>
                        {conflictResult.conflicts.map((c, i) => (
                          <li key={i}>{c.message}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    班级 <span className='text-red-500'>*</span>
                  </label>
                  <select
                    value={formData.class_info_id}
                    onChange={(e) => handleFormChange('class_info_id', parseInt(e.target.value))}
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all text-slate-800 dark:text-slate-100'
                  >
                    <option value={0}>选择班级</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} {cls.grade ? `(${cls.grade})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    科目 <span className='text-red-500'>*</span>
                  </label>
                  <select
                    value={formData.subject_id}
                    onChange={handleSubjectChange}
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all text-slate-800 dark:text-slate-100'
                  >
                    <option value={0}>选择科目</option>
                    {subjects
                      .filter((s) => s.is_active)
                      .map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    星期 <span className='text-red-500'>*</span>
                  </label>
                  <select
                    value={formData.day_of_week}
                    onChange={(e) => handleFormChange('day_of_week', parseInt(e.target.value))}
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all text-slate-800 dark:text-slate-100'
                  >
                    {weekDays.map((day) => (
                      <option key={day.day} value={day.day}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    节次 <span className='text-red-500'>*</span>
                  </label>
                  <select
                    value={formData.period_number}
                    onChange={(e) => handleFormChange('period_number', parseInt(e.target.value))}
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all text-slate-800 dark:text-slate-100'
                  >
                    {activePeriods.map((period) => (
                      <option key={period.id} value={period.period_number}>
                        {period.name} ({getPeriodTime(period.period_number)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    授课教师
                  </label>
                  <div className='relative'>
                    <User className='absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400' />
                    <select
                      value={formData.teacher_id ?? ''}
                      onChange={(e) => {
                        const tid = e.target.value ? Number(e.target.value) : undefined;
                        const teacher = teachers.find((t) => t.id === tid);
                        handleFormChange('teacher_id', tid);
                        handleFormChange('teacher_name', teacher ? teacher.name : '');
                      }}
                      className='w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all text-slate-800 dark:text-slate-100'
                    >
                      <option value=''>不指定教师</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    教室
                  </label>
                  <div className='relative'>
                    <MapPin className='absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400' />
                    <input
                      type='text'
                      value={formData.classroom}
                      onChange={(e) => handleFormChange('classroom', e.target.value)}
                      placeholder='输入教室'
                      className='w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400'
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  备注
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  placeholder='输入备注信息'
                  rows={2}
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all resize-none text-slate-800 dark:text-slate-100 placeholder-slate-400'
                />
              </div>

              {/* Conflict Check Button */}
              <button
                type='button'
                onClick={checkConflicts}
                className='w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors font-medium text-sm'
              >
                <AlertTriangle className='w-4 h-4' />
                检测时间冲突
              </button>

              <div className='flex items-center justify-end gap-3 pt-2'>
                <button
                  type='button'
                  onClick={() => {
                    closeModal();
                    setEditingSchedule(null);
                    setConflictResult(null);
                  }}
                  className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
                >
                  取消
                </button>
                <PermissionButton
                  permission='schedule.manage'
                  type='submit'
                  disabled={submitting}
                  className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 font-medium disabled:opacity-50'
                >
                  <Check className='w-5 h-5' />
                  保存
                </PermissionButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
