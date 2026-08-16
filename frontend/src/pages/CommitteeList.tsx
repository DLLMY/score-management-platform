import logger from '../utils/logger';
import { useState, useEffect, useCallback } from 'react';
import {
  Award,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Star,
  User,
  Users,
  Calendar,
  CheckCircle,
} from 'lucide-react';
import api from '../services/api';
import type { ClassCommittee, CommitteeCreateInput } from '../types';
import { useStableToast } from '../hooks/useStableToast';
import { ClassSelect, StudentSelect } from '../components/form/EntitySelect';

interface CommitteeFormData {
  position: string;
  class_id: number;
  student_id: number;
  responsibilities: string;
  term_start: string;
  term_end: string;
}

const POSITION_OPTIONS = [
  { value: 'monitor', label: '班长' },
  { value: 'vice_monitor', label: '副班长' },
  { value: 'study', label: '学习委员' },
  { value: 'life', label: '生活委员' },
  { value: 'sports', label: '体育委员' },
  { value: 'art', label: '文艺委员' },
  { value: 'propaganda', label: '宣传委员' },
  { value: 'organization', label: '组织委员' },
  { value: 'other', label: '其他' },
];

const defaultForm: CommitteeFormData = {
  position: 'monitor',
  class_id: 1,
  student_id: 0,
  responsibilities: '',
  term_start: new Date().toISOString().split('T')[0],
  term_end: '',
};

function CommitteeListPage() {
  const [committee, setCommittee] = useState<ClassCommittee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CommitteeFormData>(defaultForm);
  const { showToast } = useStableToast();

  const fetchCommittee = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.committee.getAll();
      setCommittee(data || []);
    } catch (error) {
      logger.error('获取班委名单失败:', error);
      showToast('error', '获取班委名单失败');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchCommittee();
  }, [fetchCommittee]);

  const openCreateModal = useCallback(() => {
    setEditingId(null);
    setFormData({ ...defaultForm, class_id: 0 });
    setShowFormModal(true);
  }, []);

  const openEditModal = useCallback((item: ClassCommittee) => {
    setEditingId(item.id);
    setFormData({
      position: item.position,
      class_id: item.class_id,
      student_id: item.student_id,
      responsibilities: item.responsibilities || '',
      term_start: item.term_start || '',
      term_end: item.term_end || '',
    });
    setShowFormModal(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!formData.student_id) {
      showToast('warning', '请输入学生 ID');
      return;
    }
    setIsLoading(true);
    try {
      if (editingId) {
        await api.committee.update(editingId, {
          position: formData.position,
          class_id: formData.class_id,
          student_id: formData.student_id,
          responsibilities: formData.responsibilities,
          term_start: formData.term_start,
          term_end: formData.term_end,
        });
        showToast('success', '班委信息更新成功');
      } else {
        const data: CommitteeCreateInput = {
          position: formData.position,
          class_id: formData.class_id,
          student_id: formData.student_id,
          responsibilities: formData.responsibilities,
          term_start: formData.term_start,
          term_end: formData.term_end,
        };
        await api.committee.create(data);
        showToast('success', '班委添加成功');
      }
      setShowFormModal(false);
      fetchCommittee();
    } catch (error) {
      logger.error('操作失败:', error);
      showToast('error', editingId ? '更新班委失败' : '添加班委失败');
    } finally {
      setIsLoading(false);
    }
  }, [formData, editingId, showToast, fetchCommittee]);

  const handleDelete = useCallback(async (id: number) => {
    if (!window.confirm('确定要删除这条班委记录吗？')) return;
    setIsLoading(true);
    try {
      await api.committee.delete(id);
      showToast('success', '班委记录删除成功');
      fetchCommittee();
    } catch (error) {
      logger.error('删除失败:', error);
      showToast('error', '删除班委记录失败');
    } finally {
      setIsLoading(false);
    }
  }, [showToast, fetchCommittee]);

  const getPositionLabel = useCallback((value: string) => {
    return POSITION_OPTIONS.find(p => p.value === value)?.label || value;
  }, []);

  const getPositionIcon = useCallback((position: string) => {
    const icons: Record<string, string> = {
      monitor: '🎖️',
      vice_monitor: '🥇',
      study: '📚',
      life: '🏠',
      sports: '⚽',
      art: '🎨',
      propaganda: '📢',
      organization: '🎯',
      other: '⭐',
    };
    return icons[position] || '⭐';
  }, []);

  const activeCount = committee.filter(c => c.is_active).length;
  const ratedCount = committee.filter(c => c.rating && c.rating > 0).length;

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Award className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text">
                班委名单管理
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">管理班级班委职位、任期与评价</p>
            </div>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium"
          >
            <Plus className="w-5 h-5" />
            添加班委
          </button>
        </div>
      </div>

      <div className="px-6 py-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">班委总数</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{committee.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">在任人数</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{activeCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Star className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">已评价人数</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{ratedCount}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6 overflow-auto">
        {isLoading && committee.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500 dark:text-slate-400">加载中...</p>
          </div>
        ) : committee.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              <Award className="w-10 h-10 text-slate-400" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-lg">暂无班委数据</p>
            <button onClick={openCreateModal} className="text-amber-500 hover:text-amber-600 font-medium">
              添加第一位班委
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-700/50 dark:to-slate-700/30">
                    <th className="px-5 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">职位</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">学生</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">职责</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">任期</th>
                    <th className="px-5 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">评价</th>
                    <th className="px-5 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">状态</th>
                    <th className="px-5 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {committee.map((item) => (
                    <tr
                      key={item.id}
                      className="group hover:bg-gradient-to-r hover:from-amber-50/50 hover:to-orange-50/50 dark:hover:from-slate-700/50 dark:hover:to-slate-700/30 transition-all duration-200"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getPositionIcon(item.position)}</span>
                          <span className="font-medium text-slate-800 dark:text-slate-200">{getPositionLabel(item.position)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center">
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            {item.student_name || `学生${item.student_id}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-slate-500 dark:text-slate-400 max-w-xs truncate block">
                          {item.responsibilities || '-'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {item.term_start || '-'} ~ {item.term_end || '至今'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        {item.rating ? (
                          <div className="flex items-center justify-center gap-1">
                            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                            <span className="font-medium text-slate-700 dark:text-slate-300">{item.rating.toFixed(1)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          item.is_active
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${item.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {item.is_active ? '在任' : '离任'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showFormModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowFormModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                    <Award className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {editingId ? '编辑班委信息' : '添加班委'}
                  </h3>
                </div>
                <button onClick={() => setShowFormModal(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  班级 <span className="text-red-500">*</span>
                </label>
                <ClassSelect
                  value={formData.class_id}
                  onChange={(id) => setFormData({ ...formData, class_id: id })}
                  disabled={!!editingId}
                  emptyPlaceholder='暂无班级'
                />
                {editingId && <p className="mt-1 text-xs text-slate-400">编辑时班级不可更改</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">职位</label>
                  <select
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-slate-800 dark:text-slate-100"
                  >
                    {POSITION_OPTIONS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">学生 <span className="text-red-500">*</span></label>
                  <StudentSelect
                    value={formData.student_id}
                    onChange={(id) => setFormData({ ...formData, student_id: id })}
                    allowEmpty
                    emptyLabel='请选择学生'
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">职责描述</label>
                <textarea
                  value={formData.responsibilities}
                  onChange={(e) => setFormData({ ...formData, responsibilities: e.target.value })}
                  placeholder="描述该职位的职责"
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-slate-800 dark:text-slate-100 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">任期开始</label>
                  <input
                    type="date"
                    value={formData.term_start}
                    onChange={(e) => setFormData({ ...formData, term_start: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">任期结束</label>
                  <input
                    type="date"
                    value={formData.term_end}
                    onChange={(e) => setFormData({ ...formData, term_end: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3">
              <button onClick={() => setShowFormModal(false)} className="px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium">
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-200 font-medium disabled:opacity-50"
              >
                <Check className="w-5 h-5" />
                {editingId ? '保存' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CommitteeListPage;