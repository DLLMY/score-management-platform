import type { ReactElement } from 'react';
import { Plus, GripVertical } from 'lucide-react';
import {
  Card,
  Button,
  Modal,
  PermissionButton,
  SearchFilter,
  DataTable,
  ImportExportPanel,
} from '../../components';
import type { Exam } from './types';
import type { ExamManagementViewProps } from './types';

export default function ExamManagementView({
  draftAvailable,
  handleRestoreDraft,
  handleDiscardDraft,
  importExamId,
  setImportExamId,
  exams,
  handleExport,
  handleImportFile,
  handleImportComplete,
  handleCreateExam,
  searchInput,
  setSearchInput,
  selectedClass,
  setSelectedClass,
  classes,
  columns,
  filteredExams,
  showModal,
  closeExamModal,
  editingExam,
  examFormData,
  examFormErrors,
  handleExamFormChange,
  examSubmitting,
  handleSaveExam,
  runExamSubmit,
  subjects,
  handleCreateSubject,
  handleDragStart,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  draggedIndex,
  dragOverIndex,
  handleDeleteSubject,
  showSubjectModal,
  closeSubjectModal,
  editingSubject,
  subjectFormData,
  subjectFormErrors,
  handleSubjectFormChange,
  handleSaveSubject,
}: ExamManagementViewProps): ReactElement {
  return (
    <div className='space-y-6'>
      {draftAvailable && (
        <div className='flex items-center justify-between gap-3 px-4 py-2.5 mb-4 rounded-lg bg-amber-50 border border-amber-200 text-sm'>
          <span className='text-amber-800'>检测到上次未提交的内容，是否恢复？</span>
          <div className='flex items-center gap-2'>
            <button
              onClick={handleRestoreDraft}
              className='px-3 py-1 rounded-md bg-amber-500 text-white hover:bg-amber-600 text-xs'
            >
              恢复
            </button>
            <button
              onClick={handleDiscardDraft}
              className='px-3 py-1 rounded-md border border-amber-300 text-amber-700 hover:bg-amber-100 text-xs'
            >
              放弃
            </button>
          </div>
        </div>
      )}

      <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>考试管理</h1>
          <p className='text-gray-500 mt-1'>创建和管理考试安排</p>
        </div>
        <div className='flex items-center gap-3'>
          {/* P1-1: 导入改走 /api/exam-import/execute（带 exam_id）；权限码改真实后端码（exam.import/export/template 不存在） */}
          <select
            value={importExamId}
            onChange={(e) => setImportExamId(Number(e.target.value))}
            className='h-9 px-2 rounded-lg border border-gray-200 text-sm bg-white dark:bg-gray-800 dark:border-gray-700'
            aria-label='选择导入目标考试'
          >
            <option value={0}>导入到考试…</option>
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <ImportExportPanel
            type='exam'
            showExport={true}
            showImport={true}
            showTemplate={true}
            exportUrl='/api/exams/export'
            templateUrl='/api/exam-import/template'
            onDataExport={handleExport}
            onDataImport={handleImportFile}
            onImportComplete={handleImportComplete}
            permissions={{
              import: 'score.entry',
              export: 'score.view',
              template: 'score.view',
            }}
          />
          <PermissionButton permission='exam.manage' onClick={handleCreateExam}>
            <Plus className='w-4 h-4 mr-2' />
            新建考试
          </PermissionButton>
        </div>
      </div>

      <Card>
        <div className='flex flex-wrap gap-4 items-center'>
          <SearchFilter
            value={searchInput}
            onChange={setSearchInput}
            placeholder='搜索考试名称...'
            showReset={true}
            onReset={() => {
              setSearchInput('');
              setSelectedClass('');
            }}
            selectFilters={[
              {
                label: '班级',
                value: selectedClass,
                onChange: setSelectedClass,
                options: [
                  { label: '全部班级', value: '' },
                  ...classes.map((cls: { id: number; name: string }) => ({
                    label: cls.name,
                    value: String(cls.id),
                  })),
                ],
              },
            ]}
          />
        </div>
      </Card>

      <Card>
        <DataTable<Exam>
          columns={columns}
          dataSource={filteredExams}
          rowKey='id'
          empty={{
            icon: 'file',
            title: '暂无考试数据',
          }}
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal
        isOpen={showModal}
        onClose={closeExamModal}
        title={editingExam ? '编辑考试' : '新建考试'}
      >
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>考试名称 *</label>
            <input
              type='text'
              value={examFormData.name}
              onChange={(e) => handleExamFormChange('name', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              placeholder='请输入考试名称'
            />
            {examFormErrors.name && (
              <p className='text-sm text-red-500 mt-1'>{examFormErrors.name}</p>
            )}
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>考试说明</label>
            <textarea
              value={examFormData.description}
              onChange={(e) => handleExamFormChange('description', e.target.value)}
              rows={3}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              placeholder='请输入考试说明'
            />
          </div>
          <div>
            <div className='flex items-center justify-between mb-1'>
              <label className='block text-sm font-medium text-gray-700'>考试科目 *</label>
              <PermissionButton
                permission='subject.manage'
                variant='secondary'
                size='sm'
                onClick={handleCreateSubject}
              >
                + 添加科目
              </PermissionButton>
            </div>
            <div className='space-y-1'>
              {subjects.map((subject, index) => (
                <label
                  key={subject.id}
                  className={`flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-all duration-200 ${
                    draggedIndex === index
                      ? 'opacity-50 scale-95'
                      : dragOverIndex === index
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200'
                  }`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  <GripVertical className='w-4 h-4 text-gray-400 cursor-grab hover:text-gray-600' />
                  <input
                    type='checkbox'
                    checked={examFormData.subjects.includes(subject.name)}
                    onChange={(e) => {
                      const newSubjects = e.target.checked
                        ? [...examFormData.subjects, subject.name]
                        : examFormData.subjects.filter((s) => s !== subject.name);
                      handleExamFormChange('subjects', newSubjects);
                    }}
                    className='w-4 h-4 text-primary-600 rounded focus:ring-primary-500'
                  />
                  <span
                    className='w-3 h-3 rounded-full'
                    style={{ backgroundColor: subject.color }}
                  />
                  <span className='text-sm text-gray-700'>{subject.name}</span>
                  {subject.description && (
                    <span className='text-xs text-gray-400 ml-auto'>{subject.description}</span>
                  )}
                  <Button
                    variant='danger'
                    size='xs'
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSubject(subject);
                    }}
                  >
                    删除
                  </Button>
                </label>
              ))}
            </div>
            {subjects.length === 0 && (
              <p className='text-sm text-gray-500 text-center py-4'>暂无科目，请先添加科目</p>
            )}
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>开始时间 *</label>
              <input
                type='datetime-local'
                value={examFormData.start_time}
                onChange={(e) => handleExamFormChange('start_time', e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>结束时间 *</label>
              <input
                type='datetime-local'
                value={examFormData.end_time}
                onChange={(e) => handleExamFormChange('end_time', e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              />
            </div>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>重要性</label>
            <select
              value={examFormData.importance}
              onChange={(e) =>
                handleExamFormChange('importance', e.target.value as 'low' | 'medium' | 'high')
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value='low'>低</option>
              <option value='medium'>中</option>
              <option value='high'>高</option>
            </select>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>状态</label>
            <select
              value={examFormData.status}
              onChange={(e) =>
                handleExamFormChange('status', e.target.value as 'draft' | 'published' | 'closed')
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value='draft'>草稿</option>
              <option value='published'>已发布</option>
              <option value='closed'>已结束</option>
            </select>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>班级</label>
            <select
              value={examFormData.class_id}
              onChange={(e) => handleExamFormChange('class_id', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value=''>全部班级</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
          <div className='flex space-x-3 pt-4'>
            <Button onClick={() => runExamSubmit(handleSaveExam)} disabled={examSubmitting}>
              保存
            </Button>
            <Button variant='secondary' onClick={closeExamModal}>
              取消
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showSubjectModal}
        onClose={closeSubjectModal}
        title={editingSubject ? '编辑科目' : '新建科目'}
      >
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>科目名称 *</label>
            <input
              type='text'
              value={subjectFormData.name}
              onChange={(e) => handleSubjectFormChange('name', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              placeholder='请输入科目名称'
            />
            {subjectFormErrors.name && (
              <p className='text-sm text-red-500 mt-1'>{subjectFormErrors.name}</p>
            )}
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>科目描述</label>
            <input
              type='text'
              value={subjectFormData.description}
              onChange={(e) => handleSubjectFormChange('description', e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
              placeholder='请输入科目描述'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>颜色标记</label>
            <div className='flex items-center gap-3'>
              <input
                type='color'
                value={subjectFormData.color}
                onChange={(e) => handleSubjectFormChange('color', e.target.value)}
                className='w-12 h-10 rounded cursor-pointer'
              />
              <input
                type='text'
                value={subjectFormData.color}
                onChange={(e) => handleSubjectFormChange('color', e.target.value)}
                className='flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                placeholder='#10B981'
              />
            </div>
          </div>
          <div className='flex space-x-3 pt-4'>
            <Button onClick={handleSaveSubject}>保存</Button>
            <Button variant='secondary' onClick={closeSubjectModal}>
              取消
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
