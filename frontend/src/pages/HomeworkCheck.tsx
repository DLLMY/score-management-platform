import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  CheckCircle,
  Clock,
  Search,
  X,
  FileText,
  Check,
} from 'lucide-react';
import api from '../services/api';
import { useStableToast } from '../hooks/useStableToast';
import { HomeworkAssignment, HomeworkCreateInput } from '../types';

interface HomeworkFormData {
  id: number | null;
  class_id: number;
  subject_id?: number;
  title: string;
  description?: string;
  assigned_date: string;
  due_date: string;
}

const defaultForm: HomeworkFormData = {
  id: null,
  class_id: 0,
  subject_id: undefined,
  title: '',
  description: '',
  assigned_date: new Date().toISOString().split('T')[0],
  due_date: '',
};

function HomeworkCheck() {
  const { showToast } = useStableToast();
  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [formData, setFormData] = useState<HomeworkFormData>(defaultForm);
  const [errors, setErrors] = useState<Partial<Record<keyof HomeworkFormData, string>>>({});

  const fetchAssignments = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.homework.getAll();
      setAssignments(data || []);
    } catch (error) {
      console.error('获取作业列表失败:', error);
      showToast('error', '获取作业列表失败');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const filteredAssignments = assignments.filter(
    (a) =>
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.description && a.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleOpenModal = useCallback(
    (isEdit = false, assignment?: HomeworkAssignment) => {
      if (isEdit && assignment) {
        setFormData({
          id: assignment.id,
          class_id: assignment.class_id,
          subject_id: assignment.subject_id,
          title: assignment.title,
          description: assignment.description || '',
          assigned_date: assignment.assigned_date,
          due_date: assignment.due_date,
        });
      } else {
        setFormData(defaultForm);
      }
      setErrors({});
      setShowModal(true);
    },
    []
  );

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setFormData(defaultForm);
    setErrors({});
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof HomeworkFormData, string>> = {};
    if (!formData.title.trim()) {
      newErrors.title = '请输入作业标题';
    }
    if (!formData.class_id || formData.class_id <= 0) {
      newErrors.class_id = '请选择班级';
    }
    if (!formData.due_date) {
      newErrors.due_date = '请选择截止日期';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;

    try {
      if (formData.id) {
        await api.homework.update(formData.id, {
          class_id: formData.class_id,
          subject_id: formData.subject_id,
          title: formData.title,
          description: formData.description,
          assigned_date: formData.assigned_date,
          due_date: formData.due_date,
        } as HomeworkCreateInput);
        showToast('success', '作业更新成功');
      } else {
        await api.homework.create({
          class_id: formData.class_id,
          subject_id: formData.subject_id,
          title: formData.title,
          description: formData.description,
          assigned_date: formData.assigned_date,
          due_date: formData.due_date,
        });
        showToast('success', '作业创建成功');
      }
      handleCloseModal();
      fetchAssignments();
    } catch (error) {
      console.error('操作失败:', error);
      showToast('error', formData.id ? '更新作业失败' : '创建作业失败');
    }
  }, [formData, showToast, handleCloseModal, fetchAssignments, validateForm]);

  const handleDelete = useCallback(
    async (id: number) => {
      if (!window.confirm('确定要删除这个作业吗？')) return;
      try {
        await api.homework.delete(id);
        showToast('success', '作业删除成功');
        fetchAssignments();
      } catch (error) {
        console.error('删除失败:', error);
        showToast('error', '删除作业失败');
      }
    },
    [showToast, fetchAssignments]
  );

  const totalAssignments = assignments.length;
  const completedAssignments = assignments.filter((a) => a.is_completed).length;
  const pendingAssignments = totalAssignments - completedAssignments;

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text">
                作业检查
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">管理作业布置、提交检查与批改</p>
            </div>
          </div>
          <button
            onClick={() => handleOpenModal(false)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium"
          >
            <Plus className="w-5 h-5" />
            布置作业
          </button>
        </div>
      </div>

      <div className="px-6 py-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <div className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 group hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <FileText className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">作业总数</p>
                <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{totalAssignments}</p>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 group hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">已完成</p>
                <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{completedAssignments}</p>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 group hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Clock className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">待批改</p>
                <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{pendingAssignments}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-slate-50/50 to-white/50 dark:from-slate-800/50 dark:to-slate-800">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="搜索作业标题或描述..."
                  className="w-full pl-12 pr-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-sm"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-700/50 dark:to-slate-700/30">
                  <th className="px-5 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">作业标题</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">班级</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">截止日期</th>
                  <th className="px-5 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">提交情况</th>
                  <th className="px-5 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">状态</th>
                  <th className="px-5 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">加载中...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                          <BookOpen className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400">暂无作业数据</p>
                        <button
                          onClick={() => handleOpenModal(false)}
                          className="text-blue-500 hover:text-blue-600 font-medium text-sm"
                        >
                          布置第一个作业
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAssignments.map((assignment) => (
                    <tr
                      key={assignment.id}
                      className="group hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 dark:hover:from-slate-700/50 dark:hover:to-slate-700/30 transition-all duration-200 cursor-pointer"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-800 dark:text-slate-200">{assignment.title}</p>
                            {assignment.description && (
                              <p className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-xs">{assignment.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium">
                          {assignment.class_name || `班级 #${assignment.class_id}`}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-600 dark:text-slate-300">{assignment.due_date}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-semibold">
                          {assignment.submitted_count || 0}/{assignment.total_students || 0}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            assignment.is_completed
                              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                              : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              assignment.is_completed ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                          {assignment.is_completed ? '已完成' : '进行中'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenModal(true, assignment);
                            }}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(assignment.id);
                            }}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={handleCloseModal}>
          <div
            className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {formData.id ? '编辑作业' : '布置作业'}
                  </h3>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  作业标题 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="输入作业标题"
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400 ${
                    errors.title ? 'border-red-500' : 'border-slate-200 dark:border-slate-600 focus:border-blue-500'
                  }`}
                />
                {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="输入作业描述（可选）"
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    班级 ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.class_id || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, class_id: Number(e.target.value) }))}
                    placeholder="班级 ID"
                    className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400 ${
                      errors.class_id ? 'border-red-500' : 'border-slate-200 dark:border-slate-600 focus:border-blue-500'
                    }`}
                  />
                  {errors.class_id && <p className="mt-1 text-xs text-red-500">{errors.class_id}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">学科 ID</label>
                  <input
                    type="number"
                    value={formData.subject_id ?? ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, subject_id: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="学科 ID（可选）"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">布置日期</label>
                  <input
                    type="date"
                    value={formData.assigned_date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, assigned_date: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    截止日期 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, due_date: e.target.value }))}
                    className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-800 dark:text-slate-100 ${
                      errors.due_date ? 'border-red-500' : 'border-slate-200 dark:border-slate-600 focus:border-blue-500'
                    }`}
                  />
                  {errors.due_date && <p className="mt-1 text-xs text-red-500">{errors.due_date}</p>}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3">
              <button
                onClick={handleCloseModal}
                className="px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 font-medium"
              >
                <Check className="w-5 h-5" />
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomeworkCheck;