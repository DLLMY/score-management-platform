// T12-4 拆分（2026-09-12）：自 SubjectManagementSections.tsx 原样搬出，行为逐字节等价。
import {
  Edit2,
  Trash2,
  BookOpen,
  GraduationCap,
  Layers,
  Link2,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
} from 'lucide-react';
import { PermissionButton, SearchFilter, ImportExportPanel } from '../../../components';
import type { SubjectManagementViewProps, StatusFilter } from '../types';

export function SearchAndGrid({
  searchInput,
  setSearchInput,
  isLoading,
  statusFilter,
  handleStatusFilterChange,
  handleOpenModal,
  filteredSubjects,
  handleToggleStatus,
  handleDelete,
  openClassLinkModal,
  handleExport,
  handleImportComplete,
  handleReset,
  fetchSubjects,
}: SubjectManagementViewProps) {
  return (
    <div className='flex-1 px-6 pb-6 overflow-auto'>
      <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden'>
        {/* Search Bar */}
        <div className='px-5 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-slate-50/50 to-white/50 dark:from-slate-800/50 dark:to-slate-800'>
          <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
            <SearchFilter
              value={searchInput}
              onChange={setSearchInput}
              filters={[
                { label: '全部', value: 'all' },
                { label: '启用', value: 'active' },
                { label: '禁用', value: 'inactive' },
              ]}
              activeFilter={statusFilter}
              onFilterChange={(v) => handleStatusFilterChange(v as StatusFilter)}
              placeholder='搜索科目名称、代码或年级...'
              className='flex-1'
              showReset={true}
              onReset={handleReset}
            >
              <button
                onClick={() => fetchSubjects()}
                className='p-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-all'
                title='刷新列表'
              >
                <RefreshCw className='w-5 h-5' />
              </button>
            </SearchFilter>
            <ImportExportPanel
              type='subject'
              showExport={true}
              showImport={true}
              showTemplate={true}
              acceptFormats='.json,.xlsx,.xls'
              exportUrl={`/api/subjects/export?include_inactive=${statusFilter !== 'active'}`}
              importUrl='/api/subjects/import'
              templateUrl='/api/subjects/template'
              onDataExport={handleExport}
              onImportComplete={handleImportComplete}
              permissions={{
                import: 'subject.import',
                export: 'subject.export',
                template: 'subject.template',
              }}
            />
          </div>
        </div>

        {/* Subject Grid */}
        <div className='p-5'>
          {isLoading ? (
            <div className='flex flex-col items-center justify-center py-16 gap-3'>
              <div className='w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin' />
              <p className='text-sm text-slate-500 dark:text-slate-400'>加载中...</p>
            </div>
          ) : filteredSubjects.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-16 gap-3'>
              <div className='w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center'>
                <BookOpen className='w-8 h-8 text-slate-400' />
              </div>
              <p className='text-slate-500 dark:text-slate-400'>
                {searchInput ? '未找到匹配的科目' : '暂无科目数据'}
              </p>
              {!searchInput && (
                <PermissionButton
                  permission='score.entry'
                  onClick={() => handleOpenModal(false)}
                  className='text-violet-500 hover:text-violet-600 font-medium text-sm'
                >
                  添加第一个科目
                </PermissionButton>
              )}
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
              {filteredSubjects.map((subject, index) => (
                <div
                  key={subject.id}
                  className='group relative bg-gradient-to-br from-slate-50 to-white dark:from-slate-700/50 dark:to-slate-700 rounded-2xl p-5 border border-slate-200/50 dark:border-slate-600/50 hover:shadow-lg hover:border-violet-200 dark:hover:border-violet-500/50 transition-all duration-300'
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Color Bar */}
                  <div
                    className='absolute top-0 left-4 right-4 h-1 rounded-b-full opacity-80 group-hover:opacity-100 transition-opacity'
                    style={{ backgroundColor: subject.color }}
                  />

                  <div className='flex items-start justify-between mb-4 mt-2'>
                    <div className='flex items-center gap-3'>
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md ${
                          !subject.is_active ? 'opacity-50' : ''
                        }`}
                        style={{ backgroundColor: `${subject.color}20` }}
                      >
                        <BookOpen className='w-6 h-6' style={{ color: subject.color }} />
                      </div>
                      <div>
                        <h3
                          className={`font-bold text-lg ${
                            subject.is_active
                              ? 'text-slate-800 dark:text-slate-100'
                              : 'text-slate-400 dark:text-slate-500 line-through'
                          }`}
                        >
                          {subject.name}
                        </h3>
                        {subject.code && (
                          <span className='inline-block px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-xs font-medium rounded-md'>
                            {subject.code}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className='flex items-center gap-2'>
                      <PermissionButton
                        permission='score.entry'
                        onClick={() => handleToggleStatus(subject)}
                        className={`p-2 rounded-lg transition-all ${
                          subject.is_active
                            ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                            : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-600'
                        }`}
                        title={subject.is_active ? '禁用科目' : '启用科目'}
                      >
                        {subject.is_active ? (
                          <ToggleRight className='w-5 h-5' />
                        ) : (
                          <ToggleLeft className='w-5 h-5' />
                        )}
                      </PermissionButton>
                    </div>
                  </div>

                  {subject.description && (
                    <p className='text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2'>
                      {subject.description}
                    </p>
                  )}

                  <div className='flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-600/50'>
                    <div className='flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400'>
                      {subject.grade && (
                        <span className='flex items-center gap-1'>
                          <GraduationCap className='w-4 h-4' />
                          {subject.grade}
                        </span>
                      )}
                      <span className='flex items-center gap-1'>
                        <Layers className='w-4 h-4' />
                        {subject.class_count != null ? subject.class_count : '--'}班
                      </span>
                    </div>
                    <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                      <PermissionButton
                        permission='score.entry'
                        onClick={() => openClassLinkModal(subject)}
                        className='p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all'
                        title='关联班级'
                      >
                        <Link2 className='w-4 h-4' />
                      </PermissionButton>
                      <PermissionButton
                        permission='score.entry'
                        onClick={() => handleOpenModal(true, subject)}
                        className='p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-lg transition-all'
                        title='编辑科目'
                      >
                        <Edit2 className='w-4 h-4' />
                      </PermissionButton>
                      <PermissionButton
                        permission='score.entry'
                        onClick={() => handleDelete(subject.id)}
                        className='p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all'
                        title='删除科目'
                      >
                        <Trash2 className='w-4 h-4' />
                      </PermissionButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
