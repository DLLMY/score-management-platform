import logger from '../utils/logger';
/* eslint-disable react-hooks/exhaustive-deps */
/**
 * 考试管理页面组件
 * 创建和管理考试安排
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  GripVertical,
} from 'lucide-react';
import { Card, Button, Modal, LoadingSpinner, PermissionButton, SearchFilter } from '../components';
import ImportExportPanel from '../components/special/ImportExportPanel';
import { useStableToast } from '../hooks/useStableToast';
import { useForm, useModal, useConfirmDialog, useDebouncedValue } from '../hooks';
import api, { getAuthHeaders } from '../services/api';

interface Exam {
  id: number;
  name: string;
  description?: string;
  subjects: string[] | string;
  start_time?: string;
  end_time?: string;
  importance?: 'low' | 'medium' | 'high';
  class_id?: number;
  class_name?: string;
  status?: 'draft' | 'published' | 'closed';
}

interface ClassItem {
  id: number;
  name: string;
}

interface Subject {
  id: number;
  name: string;
  description?: string;
  color?: string;
}

interface ExamFormData {
  name: string;
  description: string;
  subjects: string[];
  start_time: string;
  end_time: string;
  importance: 'low' | 'medium' | 'high';
  class_id: string;
  status: 'draft' | 'published' | 'closed';
  [key: string]: unknown;
}

interface SubjectFormData {
  name: string;
  description: string;
  color: string;
  [key: string]: unknown;
}

function ExamManagement(): React.ReactElement {
  const { showToast } = useStableToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchInput, setSearchInput] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');

  // 使用 useDebouncedValue 优化搜索
  const debouncedSearchInput = useDebouncedValue(searchInput, 300);

  // 使用 useConfirmDialog 管理删除确认
  const { show: showDeleteConfirm } = useConfirmDialog();

  // 使用 useForm 管理考试表单
  const {
    formData: examFormData,
    errors: examFormErrors,
    handleChange: handleExamFormChange,
    setFormData: setExamFormData,
    resetForm: resetExamForm,
  } = useForm<ExamFormData>({
    name: '',
    description: '',
    subjects: ['语文', '数学', '英语'],
    start_time: '',
    end_time: '',
    importance: 'medium',
    class_id: '',
    status: 'draft',
  }, {
    name: { required: true, minLength: 1, maxLength: 100 },
  });

  // 使用 useForm 管理科目表单
  const {
    formData: subjectFormData,
    errors: subjectFormErrors,
    handleChange: handleSubjectFormChange,
    resetForm: resetSubjectForm,
  } = useForm<SubjectFormData>({
    name: '',
    description: '',
    color: '#10B981',
  }, {
    name: { required: true, minLength: 1, maxLength: 50 },
  });

  // 使用 useModal 管理考试弹窗
  const { isOpen: showModal, open: openExamModal, close: closeExamModal } = useModal<Exam | null>({
    onClose: () => {
      resetExamForm();
    },
  });

  // 使用 useModal 管理科目弹窗
  const { isOpen: showSubjectModal, open: openSubjectModal, close: closeSubjectModal } = useModal<Subject | null>({
    onClose: () => {
      resetSubjectForm();
    },
  });

  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // 使用 useMemo 优化过滤逻辑
  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      const matchesSearch = exam.name?.toLowerCase().includes(debouncedSearchInput.toLowerCase());
      const matchesClass = !selectedClass || exam.class_id === parseInt(selectedClass);
      return matchesSearch && matchesClass;
    });
  }, [exams, debouncedSearchInput, selectedClass]);

  // Import/Export handled by ImportExportPanel component

  const fetchData = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [examsRes, classesRes, subjectsRes] = await Promise.all([
        api.exams.getAll({ skipCache: true }),
        api.classes.getAll(),
        api.subjects.getAll(),
      ]);
      
      setExams(Array.isArray(examsRes) ? examsRes as unknown as Exam[] : ((examsRes as { data?: unknown[] })?.data || []) as unknown as Exam[]);
      setClasses(Array.isArray(classesRes) ? classesRes : ((classesRes as { classes?: ClassItem[] })?.classes || []));
      setSubjects(Array.isArray(subjectsRes) ? subjectsRes : []);
    } catch (err: unknown) {
      showToast('error', '获取数据失败: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDragStart = useCallback((e: React.DragEvent, index: number): void => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number): void => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (index !== draggedIndex) {
      setDragOverIndex(index);
    }
  }, [draggedIndex]);

  const handleDragLeave = useCallback((): void => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetIndex: number): Promise<void> => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDragOverIndex(null);
      setDraggedIndex(null);
      return;
    }

    const newSubjects = [...subjects];
    const draggedSubject = newSubjects[draggedIndex];
    newSubjects.splice(draggedIndex, 1);
    newSubjects.splice(targetIndex, 0, draggedSubject);

    setSubjects(newSubjects);
    
    try {
      const orderData = newSubjects.map((subject, idx) => ({
        id: subject.id,
        order: idx + 1,
      }));
      await api.subjects.updateOrder(orderData);
    } catch (err) {
      logger.error('更新科目顺序失败:', err);
      showToast('error', '科目顺序更新失败，请重试');
    }

    setDragOverIndex(null);
    setDraggedIndex(null);
  }, [draggedIndex, subjects]);

  const handleCreateExam = useCallback((): void => {
    setEditingExam(null);
    resetExamForm();
    openExamModal(null);
  }, [resetExamForm, openExamModal]);

  const handleEditExam = useCallback((exam: Exam): void => {
    setEditingExam(exam);
    setExamFormData({
      name: exam.name || '',
      description: exam.description || '',
      subjects: exam.subjects ? (Array.isArray(exam.subjects) ? exam.subjects : exam.subjects.split(',').map((s: string) => s.trim())) : [],
      start_time: exam.start_time ? new Date(exam.start_time).toISOString().slice(0, 16) : '',
      end_time: exam.end_time ? new Date(exam.end_time).toISOString().slice(0, 16) : '',
      importance: exam.importance || 'medium',
      class_id: exam.class_id ? String(exam.class_id) : '',
      status: exam.status || 'draft',
    });
    openExamModal(exam);
  }, [setExamFormData, openExamModal]);

  const handleCreateSubject = useCallback((): void => {
    setEditingSubject(null);
    resetSubjectForm();
    openSubjectModal(null);
  }, [resetSubjectForm, openSubjectModal]);

  const handleSaveSubject = useCallback(async (): Promise<void> => {
    if (!subjectFormData.name) {
      showToast('error', '请输入科目名称');
      return;
    }

    try {
      if (editingSubject) {
        await api.subjects.update(editingSubject.id, subjectFormData);
        showToast('success', '科目更新成功');
      } else {
        await api.subjects.create(subjectFormData);
        showToast('success', '科目创建成功');
      }
      closeSubjectModal();
      fetchData();
    } catch (err: unknown) {
      showToast('error', '保存失败: ' + (err as Error).message);
    }
  }, [subjectFormData, editingSubject, showToast, fetchData, closeSubjectModal]);

  const handleDeleteSubject = useCallback(async (subject: Subject): Promise<void> => {
    if (!window.confirm(`确定要删除科目 ${subject.name} 吗？`)) return;

    try {
      await api.subjects.delete(subject.id);
      showToast('success', '科目删除成功');
      fetchData();
    } catch (err: unknown) {
      showToast('error', '删除失败: ' + (err as Error).message);
    }
  }, [showDeleteConfirm, showToast, fetchData]);

  const handleExport = useCallback(async (format: 'excel' | 'csv'): Promise<Blob> => {
    const response = await fetch(`/api/exams/export?format=${format}`, {
      method: 'GET',
      credentials: 'include',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error('导出失败');
    }
    return response.blob();
  }, []);

  const handleImportComplete = useCallback((result: { success: boolean }) => {
    if (result.success) {
      fetchData();
    }
  }, [fetchData]);

  const handleSaveExam = useCallback(async (): Promise<void> => {
    if (!examFormData.name) {
      showToast('error', '请输入考试名称');
      return;
    }

    if (!examFormData.start_time || !examFormData.end_time) {
      showToast('error', '请选择开始和结束时间');
      return;
    }

    if (!examFormData.subjects || examFormData.subjects.length === 0) {
      showToast('error', '请至少选择一个科目');
      return;
    }

    try {
      const data = {
        ...examFormData,
        subjects: examFormData.subjects,
        start_time: new Date(examFormData.start_time).toISOString(),
        end_time: new Date(examFormData.end_time).toISOString(),
        class_id: examFormData.class_id ? parseInt(examFormData.class_id) : undefined,
      };

      if (editingExam) {
        await api.exams.update(editingExam.id, data);
        showToast('success', '考试更新成功');
      } else {
        await api.exams.create(data);
        showToast('success', '考试创建成功');
      }

      closeExamModal();
      fetchData();
    } catch (err: unknown) {
      showToast('error', '保存失败: ' + (err as Error).message);
    }
  }, [examFormData, editingExam, showToast, fetchData, closeExamModal]);

  const handlePublishExam = useCallback(async (exam: Exam): Promise<void> => {
    if (!window.confirm(`确定要发布考试 ${exam.name} 吗？`)) return;

    try {
      await api.exams.publish(exam.id);
      showToast('success', '考试发布成功');
    } catch (err: unknown) {
      showToast('error', '发布失败: ' + (err as Error).message);
    } finally {
      fetchData();
    }
  }, [showDeleteConfirm, showToast, fetchData]);

  const handleCloseExam = useCallback(async (exam: Exam): Promise<void> => {
    if (!window.confirm(`确定要结束考试 ${exam.name} 吗？`)) return;

    try {
      await api.exams.close(exam.id);
      showToast('success', '考试已结束');
    } catch (err: unknown) {
      showToast('error', '操作失败: ' + (err as Error).message);
    } finally {
      fetchData();
    }
  }, [showDeleteConfirm, showToast, fetchData]);

  const handleDeleteExam = useCallback(async (exam: Exam): Promise<void> => {
    if (!window.confirm(`确定要删除考试 ${exam.name} 吗？`)) return;

    try {
      await api.exams.delete(exam.id);
      showToast('success', '考试删除成功');
    } catch (err: unknown) {
      showToast('error', '删除失败: ' + (err as Error).message);
    } finally {
      fetchData();
    }
  }, [showDeleteConfirm, showToast, fetchData]);

  const getStatusBadge = (status?: string): React.ReactElement => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      published: 'bg-green-100 text-green-800',
      closed: 'bg-blue-100 text-blue-800',
    };
    const labels: Record<string, string> = {
      draft: '草稿',
      published: '进行中',
      closed: '已结束',
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status || 'draft']}`}>
        {labels[status || 'draft'] || status}
      </span>
    );
  };

  const getImportanceBadge = (importance?: string): React.ReactElement => {
    const styles: Record<string, string> = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      low: '低',
      medium: '中',
      high: '高',
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[importance || 'medium']}`}>
        {labels[importance || 'medium'] || importance}
      </span>
    );
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className='space-y-6'>
      <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>考试管理</h1>
          <p className='text-gray-500 mt-1'>创建和管理考试安排</p>
        </div>
        <div className='flex items-center gap-3'>
          <ImportExportPanel
            type="exam"
            showExport={true}
            showImport={true}
            showTemplate={true}
            exportUrl="/api/exams/export"
            importUrl="/api/exams/import"
            templateUrl="/api/exams/template"
            onDataExport={handleExport}
            onImportComplete={handleImportComplete}
            permissions={{
              import: 'exam.import',
              export: 'exam.export',
              template: 'exam.template',
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
                  ...classes.map((cls: { id: number; name: string }) => ({ label: cls.name, value: String(cls.id) })),
                ],
              },
            ]}
          />
        </div>
      </Card>

      <Card>
        <div className='overflow-x-auto'>
          <table className='min-w-full divide-y divide-gray-200'>
            <thead className='bg-gray-50'>
              <tr>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                  考试信息
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                  科目
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                  时间
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                  状态
                </th>
                <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase'>
                  操作
                </th>
              </tr>
            </thead>
            <tbody className='bg-white divide-y divide-gray-200'>
              {filteredExams.length > 0 ? (
                filteredExams.map((exam) => (
                  <tr key={exam.id} className='hover:bg-gray-50'>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <div className='flex items-center'>
                        <div className='flex-shrink-0 h-10 w-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center'>
                          <Calendar className='w-5 h-5 text-white' />
                        </div>
                        <div className='ml-4'>
                          <div className='text-sm font-medium text-gray-900'>
                            {exam.name}
                          </div>
                          <div className='text-sm text-gray-500'>
                            {exam.class_name || '全部班级'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className='px-6 py-4'>
                      <div className='text-sm text-gray-900'>
                        {Array.isArray(exam.subjects) ? exam.subjects.join(', ') : exam.subjects || '-'}
                      </div>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <div className='text-sm text-gray-900'>
                        <div className='flex items-center gap-1'>
                          <Clock className='w-4 h-4 text-gray-400' />
                          {exam.start_time ? new Date(exam.start_time).toLocaleString('zh-CN') : '-'}
                        </div>
                        {exam.end_time && (
                          <div className='text-gray-500 text-xs mt-1'>
                            至 {new Date(exam.end_time).toLocaleString('zh-CN')}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <div className='flex items-center gap-2'>
                        {getStatusBadge(exam.status)}
                        {getImportanceBadge(exam.importance)}
                      </div>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2'>
                      {exam.status === 'draft' && (
                        <>
                          <Button variant='secondary' size='sm' onClick={() => handleEditExam(exam)}>
                            <Edit2 className='w-4 h-4' />
                          </Button>
                          <PermissionButton permission='exam.manage' size='sm' onClick={() => handlePublishExam(exam)}>
                            <CheckCircle className='w-4 h-4' />
                          </PermissionButton>
                          <PermissionButton permission='exam.manage' variant='danger' size='sm' onClick={() => handleDeleteExam(exam)}>
                            <Trash2 className='w-4 h-4' />
                          </PermissionButton>
                        </>
                      )}
                      {exam.status === 'published' && (
                        <PermissionButton permission='exam.manage' variant='secondary' size='sm' onClick={() => handleCloseExam(exam)}>
                          <XCircle className='w-4 h-4' />
                        </PermissionButton>
                      )}
                      {exam.status === 'closed' && (
                        <Button variant='secondary' size='sm' onClick={() => handleEditExam(exam)}>
                          <Edit2 className='w-4 h-4' />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className='px-6 py-12 text-center text-gray-500'>
                    <Calendar className='w-12 h-12 mx-auto mb-3 text-gray-300' />
                    <p>暂无考试数据</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
            {examFormErrors.name && <p className='text-sm text-red-500 mt-1'>{examFormErrors.name}</p>}
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
              <PermissionButton permission='subject.manage' variant='secondary' size='sm' onClick={handleCreateSubject}>
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
              onChange={(e) => handleExamFormChange('importance', e.target.value as 'low' | 'medium' | 'high')}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value='low'>低</option>
              <option value='medium'>中</option>
              <option value='high'>高</option>
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
            <Button onClick={handleSaveExam}>保存</Button>
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
            {subjectFormErrors.name && <p className='text-sm text-red-500 mt-1'>{subjectFormErrors.name}</p>}
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

export default ExamManagement;