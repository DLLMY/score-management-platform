import logger from '../../utils/logger';
import { downloadBlob } from '../../utils/download';
import {
  Plus,
  Clock,
  Calendar,
  X,
  Check,
  Building2,
  User,
  MapPin,
  ChevronDown,
  Download,
  Upload,
  FileJson,
  AlertTriangle,
  ClipboardList,
  Table,
} from 'lucide-react';
import api, { getAuthHeaders } from '../../services/api';
import { PermissionButton, DataTable } from '../../components';
import type { ClassPeriod } from '../../services/api';
import type { CourseScheduleViewProps } from './types';

function CourseScheduleView(props: CourseScheduleViewProps) {
  const {
    schedulesError,
    exportFormat,
    setExportFormat,
    exportSchedule,
    handleAdd,
    openImportModalWithData,
    totalSchedules,
    uniqueSubjects,
    uniqueTeachers,
    classes,
    selectedClass,
    setSelectedClass,
    showClassDropdown,
    setShowClassDropdown,
    filteredSchedules,
    columns,
    activePeriods,
    isLoading,
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
    showImportModal,
    closeImportModalWithReset,
    importConfigs,
    selectedConfigId,
    setSelectedConfigId,
    conflictStrategy,
    setConflictStrategy,
    fileInputRef,
    handleFileChange,
    importFile,
    setImportFile,
    importResult,
    isImporting,
    handleImport,
    showToast,
  } = props;

  return (
    <div className='flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
      {schedulesError && (
        <div className='mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30'>
          <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0' />
          <p className='text-sm text-amber-700 dark:text-amber-300'>
            课程表加载失败，当前课表可能不完整，请刷新重试
          </p>
        </div>
      )}
      {/* Header */}
      <div className='px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div className='relative'>
              <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20'>
                <Calendar className='w-6 h-6 text-white' />
              </div>
              <div className='absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center'>
                <div className='w-2 h-2 bg-white rounded-full' />
              </div>
            </div>
            <div>
              <h1 className='text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text'>
                课程表管理
              </h1>
              <p className='text-sm text-slate-500 dark:text-slate-400'>
                管理班级课程安排，支持可视化时间表和冲突检测
              </p>
            </div>
          </div>
          <div className='flex items-center gap-3'>
            <PermissionButton
              permission='schedule.manage'
              onClick={exportSchedule}
              className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
            >
              <Download className='w-5 h-5' />
              导出课程表
            </PermissionButton>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'json' | 'excel')}
              className='px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm'
            >
              <option value='excel'>Excel 格式</option>
              <option value='json'>JSON 格式</option>
            </select>
            <button
              onClick={openImportModalWithData}
              className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
            >
              <Upload className='w-5 h-5' />
              导入课程表
            </button>
            <PermissionButton
              permission='schedule.manage'
              onClick={() => handleAdd()}
              className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
            >
              <Plus className='w-5 h-5' />
              添加课程安排
            </PermissionButton>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className='px-6 py-5'>
        <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
          <div className='relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 group hover:shadow-md transition-all duration-300'>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500' />
            <div className='relative flex items-center gap-4'>
              <div className='w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20'>
                <Table className='w-7 h-7 text-white' />
              </div>
              <div>
                <p className='text-sm font-medium text-slate-500 dark:text-slate-400'>课程总数</p>
                <p className='text-3xl font-bold text-slate-800 dark:text-slate-100'>
                  {totalSchedules}
                </p>
              </div>
            </div>
          </div>

          <div className='relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 group hover:shadow-md transition-all duration-300'>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-violet-500/10 to-purple-500/10 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500' />
            <div className='relative flex items-center gap-4'>
              <div className='w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/20'>
                <ClipboardList className='w-7 h-7 text-white' />
              </div>
              <div>
                <p className='text-sm font-medium text-slate-500 dark:text-slate-400'>涉及科目</p>
                <p className='text-3xl font-bold text-slate-800 dark:text-slate-100'>
                  {uniqueSubjects}
                </p>
              </div>
            </div>
          </div>

          <div className='relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 group hover:shadow-md transition-all duration-300'>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500' />
            <div className='relative flex items-center gap-4'>
              <div className='w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20'>
                <User className='w-7 h-7 text-white' />
              </div>
              <div>
                <p className='text-sm font-medium text-slate-500 dark:text-slate-400'>授课教师</p>
                <p className='text-3xl font-bold text-slate-800 dark:text-slate-100'>
                  {uniqueTeachers}
                </p>
              </div>
            </div>
          </div>

          <div className='relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 group hover:shadow-md transition-all duration-300'>
            <div className='absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500' />
            <div className='relative flex items-center gap-4'>
              <div className='w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20'>
                <Building2 className='w-7 h-7 text-white' />
              </div>
              <div>
                <p className='text-sm font-medium text-slate-500 dark:text-slate-400'>班级数量</p>
                <p className='text-3xl font-bold text-slate-800 dark:text-slate-100'>
                  {classes.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Class Selector and Table */}
      <div className='flex-1 px-6 pb-6 overflow-auto'>
        <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden'>
          {/* Class Selector Bar */}
          <div className='px-5 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-slate-50/50 to-white/50 dark:from-slate-800/50 dark:to-slate-800'>
            <div className='flex items-center justify-between'>
              <div className='relative'>
                <button
                  onClick={() => setShowClassDropdown(!showClassDropdown)}
                  className='flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 hover:border-cyan-400 dark:hover:border-cyan-500 transition-all duration-200 min-w-[200px] justify-between shadow-sm'
                >
                  <div className='flex items-center gap-3'>
                    <Building2 className='w-5 h-5 text-cyan-500' />
                    <span className='text-slate-700 dark:text-slate-200 font-medium'>
                      {classes.find((c) => c.id === selectedClass)?.name || '选择班级'}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                      showClassDropdown ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {showClassDropdown && (
                  <>
                    <div
                      className='fixed inset-0 z-40'
                      onClick={() => setShowClassDropdown(false)}
                    />
                    <div className='absolute top-full left-0 mt-2 w-full bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden'>
                      {classes.map((cls) => (
                        <button
                          key={cls.id}
                          onClick={() => {
                            setSelectedClass(cls.id);
                            setShowClassDropdown(false);
                          }}
                          className={`w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-3 ${
                            selectedClass === cls.id
                              ? 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400'
                              : 'text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <Building2 className='w-4 h-4' />
                          <span className='font-medium'>{cls.name}</span>
                          {cls.grade && <span className='text-xs text-slate-400'>{cls.grade}</span>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className='flex items-center gap-4'>
                <div className='flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg'>
                  <Clock className='w-4 h-4' />
                  <span>
                    共{' '}
                    <strong className='text-slate-700 dark:text-slate-200'>
                      {filteredSchedules.length}
                    </strong>{' '}
                    节课程
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Schedule Table */}
          <DataTable<ClassPeriod>
            columns={columns}
            dataSource={activePeriods}
            loading={isLoading}
            rowKey='id'
            empty={{
              icon: 'settings',
              title: '暂无课程节次设置',
              description: '请先设置课程节次，再添加课程安排',
              actionLabel: '设置课程节次',
              onAction: () => {
                window.location.hash = '#/class-period-settings';
              },
            }}
            scroll={{ x: 1100 }}
          />
        </div>
      </div>

      {/* Modal */}
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

      {/* Import Modal */}
      {showImportModal && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4'
          onClick={closeImportModalWithReset}
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
                    <Upload className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    导入课程表数据
                  </h3>
                </div>
                <button
                  onClick={closeImportModalWithReset}
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <div className='px-6 py-5 space-y-5'>
              <div className='p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400'>
                    <FileJson className='w-4 h-4' />
                    <span>支持 JSON 和 Excel 格式的课程表数据文件（包含班级和科目信息）</span>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch(
                          api.importConfig.downloadTemplate('course_schedule')
                        );
                        if (!response.ok) throw new Error('下载失败');
                        const blob = await response.blob();
                        downloadBlob(blob, '课程表导入模板.xlsx');
                      } catch (error) {
                        logger.error('下载模板失败:', error);
                        showToast('error', '下载模板失败');
                      }
                    }}
                    className='flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800/30 transition-colors'
                  >
                    <Download className='w-4 h-4' />
                    下载模板
                  </button>
                </div>
              </div>

              <div className='p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800'>
                <div className='flex items-center gap-2 mb-3'>
                  <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400' />
                  <span className='text-sm font-medium text-amber-800 dark:text-amber-300'>
                    必填字段说明
                  </span>
                </div>
                <ul className='space-y-1.5 text-sm text-amber-700 dark:text-amber-400'>
                  <li>
                    <span className='font-medium'>班级名称</span>：必须是系统中已存在的班级
                  </li>
                  <li>
                    <span className='font-medium'>科目名称</span>：必须是系统中已存在的科目
                  </li>
                  <li>
                    <span className='font-medium'>星期</span>：周一至周日
                  </li>
                  <li>
                    <span className='font-medium'>节次</span>：数字，如1、2、3
                  </li>
                </ul>
                <p className='mt-2 text-xs text-amber-600 dark:text-amber-500'>
                  提示：下载模板后，请参考"填写说明"工作表了解详细的字段填写规则
                </p>
              </div>

              {importConfigs.length > 0 && (
                <div className='p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl'>
                  <label className='block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2'>
                    选择导入配置
                  </label>
                  <select
                    value={selectedConfigId || ''}
                    onChange={(e) =>
                      setSelectedConfigId(e.target.value ? parseInt(e.target.value) : null)
                    }
                    className='w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500'
                  >
                    <option value=''>使用默认配置</option>
                    {importConfigs.map((config) => (
                      <option key={config.id} value={config.id}>
                        {config.config_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className='p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl'>
                <label className='block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2'>
                  冲突处理策略
                </label>
                <div className='space-y-2'>
                  <label className='flex items-center gap-3 p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl cursor-pointer hover:border-indigo-400 transition-colors'>
                    <input
                      type='radio'
                      name='conflictStrategy'
                      value='update'
                      checked={conflictStrategy === 'update'}
                      onChange={(e) =>
                        setConflictStrategy(e.target.value as 'skip' | 'update' | 'error')
                      }
                      className='w-4 h-4 text-indigo-600 focus:ring-indigo-500'
                    />
                    <div>
                      <div className='font-medium text-slate-800 dark:text-slate-100'>
                        更新已存在课程
                      </div>
                      <div className='text-sm text-slate-500 dark:text-slate-400'>
                        如果同一班级在同一时间已有课程，将更新为新的课程信息
                      </div>
                    </div>
                  </label>
                  <label className='flex items-center gap-3 p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl cursor-pointer hover:border-indigo-400 transition-colors'>
                    <input
                      type='radio'
                      name='conflictStrategy'
                      value='skip'
                      checked={conflictStrategy === 'skip'}
                      onChange={(e) =>
                        setConflictStrategy(e.target.value as 'skip' | 'update' | 'error')
                      }
                      className='w-4 h-4 text-indigo-600 focus:ring-indigo-500'
                    />
                    <div>
                      <div className='font-medium text-slate-800 dark:text-slate-100'>
                        跳过已存在课程
                      </div>
                      <div className='text-sm text-slate-500 dark:text-slate-400'>
                        如果同一班级在同一时间已有课程，将跳过该条记录
                      </div>
                    </div>
                  </label>
                  <label className='flex items-center gap-3 p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl cursor-pointer hover:border-indigo-400 transition-colors'>
                    <input
                      type='radio'
                      name='conflictStrategy'
                      value='error'
                      checked={conflictStrategy === 'error'}
                      onChange={(e) =>
                        setConflictStrategy(e.target.value as 'skip' | 'update' | 'error')
                      }
                      className='w-4 h-4 text-indigo-600 focus:ring-indigo-500'
                    />
                    <div>
                      <div className='font-medium text-slate-800 dark:text-slate-100'>
                        视为导入错误
                      </div>
                      <div className='text-sm text-slate-500 dark:text-slate-400'>
                        如果同一班级在同一时间已有课程，将视为导入错误并记录
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {!importResult ? (
                <>
                  <div
                    className='border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl p-8 text-center hover:border-amber-400 dark:hover:border-amber-500 transition-colors cursor-pointer'
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type='file'
                      accept='.json,.xlsx,.xls'
                      onChange={handleFileChange}
                      className='hidden'
                    />
                    <div className='w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center'>
                      <Upload className='w-8 h-8 text-amber-600 dark:text-amber-400' />
                    </div>
                    <p className='text-lg font-semibold text-slate-700 dark:text-slate-200'>
                      点击或拖拽文件到此处
                    </p>
                    <p className='text-sm text-slate-500 dark:text-slate-400 mt-1'>
                      支持 .json、.xlsx、.xls 格式文件
                    </p>
                  </div>

                  {importFile && (
                    <div className='flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800'>
                      <div className='flex items-center gap-3'>
                        <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center'>
                          <FileJson className='w-5 h-5 text-white' />
                        </div>
                        <div>
                          <p className='font-medium text-slate-900 dark:text-slate-100'>
                            {importFile.name}
                          </p>
                          <p className='text-sm text-slate-500 dark:text-slate-400'>
                            {(importFile.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setImportFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className='p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors'
                      >
                        <X className='w-5 h-5' />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className='space-y-4'>
                  <div
                    className='flex items-center justify-center gap-4 p-4 rounded-xl'
                    style={{
                      backgroundColor: importResult.success
                        ? 'rgba(16, 185, 129, 0.1)'
                        : 'rgba(239, 68, 68, 0.1)',
                    }}
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        importResult.success ? 'bg-emerald-500' : 'bg-red-500'
                      }`}
                    >
                      {importResult.success ? (
                        <Check className='w-6 h-6 text-white' />
                      ) : (
                        <X className='w-6 h-6 text-white' />
                      )}
                    </div>
                    <div className='text-center'>
                      <p className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                        导入完成
                      </p>
                      <p className='text-sm text-slate-500 dark:text-slate-400'>
                        总计 {importResult.total} 条 | 成功 {importResult.success_count} 条 | 失败{' '}
                        {importResult.failed_count} 条
                      </p>
                    </div>
                  </div>

                  {importResult.messages.length > 0 && (
                    <div className='max-h-[300px] overflow-y-auto space-y-2'>
                      <p className='text-sm font-medium text-slate-500 dark:text-slate-400'>
                        导入详情：
                      </p>
                      {importResult.messages.map((msg, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg text-sm ${
                            msg.action === 'failed'
                              ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                              : msg.action === 'created'
                              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                              : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          {msg.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3'>
              <button
                onClick={closeImportModalWithReset}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                关闭
              </button>
              {importResult && importResult.failed_count && importResult.failed_count > 0 && (
                <button
                  onClick={() => {
                    const errors = importResult
                      .messages!.filter((msg) => msg.action === 'failed')
                      .map((msg) => ({
                        ...msg,
                        error_fields: msg.error_fields || [],
                      }));
                    if (errors.length > 0) {
                      fetch('/api/export/errors', {
                        method: 'POST',
                        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                        body: JSON.stringify({ errors, module: 'course_schedule' }),
                      })
                        .then((response) => response.blob())
                        .then((blob) => {
                          downloadBlob(blob, '课程表导入错误数据.xlsx');
                        });
                    }
                  }}
                  className='flex items-center gap-2 px-5 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-medium'
                >
                  <Download className='w-4 h-4' />
                  导出错误数据
                </button>
              )}
              {!importResult && (
                <PermissionButton
                  permission='schedule.manage'
                  onClick={handleImport}
                  disabled={!importFile || isImporting}
                  className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-200 font-medium disabled:opacity-50'
                >
                  {isImporting ? (
                    <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin' />
                  ) : (
                    <Upload className='w-5 h-5' />
                  )}
                  开始导入
                </PermissionButton>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CourseScheduleView;
