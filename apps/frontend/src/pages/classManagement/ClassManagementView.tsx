import type { ReactElement } from 'react';
import { Building2, Plus, Download, Upload, UserPlus, Edit2, Trash2 } from 'lucide-react';
import { PermissionButton, SearchFilter, DataTable } from '../../components';
import type { ClassInfo } from '../../services/api';
import StatisticsCards from './StatisticsCards';
import ClassFormModal from './ClassFormModal';
import HeadTeacherModal from './HeadTeacherModal';
import TeacherPreviewDialog from './TeacherPreviewDialog';
import ImportModal from './ImportModal';
import type { ClassManagementViewProps } from './types';

export default function ClassManagementView({
  searchInput,
  setSearchInput,
  handleExport,
  exportFormat,
  setExportFormat,
  openImportModal,
  classTotal,
  totalStudents,
  classesWithTeacher,
  columns,
  classItems,
  classLoading,
  page,
  pageSize,
  handlePageChange,
  handleOpenModal,
  openHeadTeacherModal,
  handleDelete,
  showHeadTeacherModal,
  showModal,
  formData,
  errors,
  handleChangeEvent,
  handleChange,
  closeModal,
  validateAll,
  onSubmit,
  selectedClass,
  closeHeadTeacherModal,
  showRemoveConfirmDialog,
  searchTeacherTerm,
  setSearchTeacherTerm,
  filteredTeachers,
  showTeacherPreviewDialog,
  showTeacherPreview,
  teacherPreview,
  isLoading,
  closeTeacherPreview,
  confirmAssignHeadTeacher,
  showImportModal,
  importConfigs,
  selectedConfigId,
  setSelectedConfigId,
  importFile,
  setImportFile,
  fileInputRef,
  handleFileChange,
  importResult,
  handleExportErrors,
  isImporting,
  handleImport,
  closeImportModal,
  showToast,
}: ClassManagementViewProps): ReactElement {
  return (
    <div className='flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
      {/* Header */}
      <div className='px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div className='relative'>
              <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-blue-500/20'>
                <Building2 className='w-6 h-6 text-white' />
              </div>
              <div className='absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center'>
                <div className='w-2 h-2 bg-white rounded-full' />
              </div>
            </div>
            <div>
              <h1 className='text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text'>
                班级管理
              </h1>
              <p className='text-sm text-slate-500 dark:text-slate-400'>
                管理班级信息、班主任和学生
              </p>
            </div>
          </div>
          <PermissionButton
            permission='class.manage'
            onClick={() => handleOpenModal(false)}
            className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
          >
            <Plus className='w-5 h-5' />
            添加班级
          </PermissionButton>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className='px-6 py-5'>
        <StatisticsCards
          classTotal={classTotal}
          totalStudents={totalStudents}
          classesWithTeacher={classesWithTeacher}
        />
      </div>

      {/* Search and Table */}
      <div className='flex-1 px-6 pb-6'>
        <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden'>
          {/* Search Bar */}
          <div className='px-5 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-slate-50/50 to-white/50 dark:from-slate-800/50 dark:to-slate-800'>
            <div className='flex items-center gap-4'>
              <SearchFilter
                searchTerm={searchInput}
                onSearchChange={setSearchInput}
                placeholder='搜索班级名称、年级或描述...'
              />
              <PermissionButton
                permission='class.view'
                onClick={handleExport}
                className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
              >
                <Download className='w-5 h-5' />
                导出班级
              </PermissionButton>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'json' | 'excel')}
                className='px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm'
              >
                <option value='excel'>Excel 格式</option>
                <option value='json'>JSON 格式</option>
              </select>
              <PermissionButton
                permission='class.manage'
                onClick={openImportModal}
                className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
              >
                <Upload className='w-5 h-5' />
                导入班级
              </PermissionButton>
            </div>
          </div>

          {/* Table */}
          <DataTable<ClassInfo>
            columns={columns}
            dataSource={classItems}
            loading={classLoading}
            rowKey='id'
            total={classTotal}
            page={page}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            rowClassName={() => 'group'}
            empty={{
              icon: 'folder',
              title: '暂无班级数据',
              actionLabel: '添加第一个班级',
              onAction: () => handleOpenModal(false),
            }}
            scroll={{ x: 900 }}
            rowActions={(cls) => (
              <div className='flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity'>
                <PermissionButton
                  permission='class.manage'
                  onClick={() => openHeadTeacherModal(cls)}
                  className='p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-all'
                >
                  <UserPlus className='w-4 h-4' />
                </PermissionButton>
                <PermissionButton
                  permission='class.manage'
                  onClick={() => handleOpenModal(true, cls)}
                  className='p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all'
                >
                  <Edit2 className='w-4 h-4' />
                </PermissionButton>
                <PermissionButton
                  /* S1: class.delete 后端无此码，统一 class.manage */
                  permission='class.manage'
                  onClick={() => handleDelete(cls.id)}
                  className='p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all'
                >
                  <Trash2 className='w-4 h-4' />
                </PermissionButton>
              </div>
            )}
          />
        </div>
      </div>

      <ClassFormModal
        isOpen={showModal}
        formData={formData}
        errors={errors}
        handleChangeEvent={handleChangeEvent}
        handleChange={handleChange}
        closeModal={closeModal}
        validateAll={validateAll}
        onSubmit={onSubmit}
      />
      <HeadTeacherModal
        isOpen={showHeadTeacherModal}
        selectedClass={selectedClass}
        closeHeadTeacherModal={closeHeadTeacherModal}
        showRemoveConfirmDialog={showRemoveConfirmDialog}
        searchTeacherTerm={searchTeacherTerm}
        setSearchTeacherTerm={setSearchTeacherTerm}
        filteredTeachers={filteredTeachers}
        showTeacherPreviewDialog={showTeacherPreviewDialog}
      />
      <TeacherPreviewDialog
        isOpen={showTeacherPreview}
        teacherPreview={teacherPreview}
        isLoading={isLoading}
        closeTeacherPreview={closeTeacherPreview}
        confirmAssignHeadTeacher={confirmAssignHeadTeacher}
      />
      <ImportModal
        isOpen={showImportModal}
        importConfigs={importConfigs}
        selectedConfigId={selectedConfigId}
        setSelectedConfigId={setSelectedConfigId}
        importFile={importFile}
        setImportFile={setImportFile}
        fileInputRef={fileInputRef}
        handleFileChange={handleFileChange}
        importResult={importResult}
        handleExportErrors={handleExportErrors}
        isImporting={isImporting}
        handleImport={handleImport}
        closeImportModal={closeImportModal}
        showToast={showToast}
      />
    </div>
  );
}
