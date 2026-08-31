import logger from '../utils/logger';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Star,
  Search,
  X,
  Check,
  UserPlus,
  UserMinus,
  Trophy,
  Target,
  Sparkles,
} from 'lucide-react';
import api from '../services/api';
import { useStableToast } from '../hooks/useStableToast';
import { useWorkbenchClass } from '../hooks/useWorkbenchClass';
import CurrentClassLabel from '../components/workbench/CurrentClassLabel';
import WorkbenchBreadcrumb from '../components/workbench/WorkbenchBreadcrumb';
import { EmptyState, LoadingSpinner, StatCard } from '../components';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { StudyGroup, StudyGroupCreateInput, StudyGroupMember } from '../types';
import { ClassSelect, StudentSelect } from '../components/form/EntitySelect';

interface GroupFormData {
  id: number | null;
  class_id: number;
  name: string;
  leader_id?: number;
  description?: string;
  member_ids: number[];
}

const defaultGroupForm: GroupFormData = {
  id: null,
  class_id: 0,
  name: '',
  leader_id: undefined,
  description: '',
  member_ids: [],
};

function StudyGroups() {
  const { showToast } = useStableToast();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formData, setFormData] = useState<GroupFormData>(defaultGroupForm);
  const [errors, setErrors] = useState<Partial<Record<keyof GroupFormData, string>>>({});
  const [selectedGroup, setSelectedGroup] = useState<StudyGroup | null>(null);
  const [scoreAdjustValue, setScoreAdjustValue] = useState<string>('');
  const [scoreReason, setScoreReason] = useState<string>('');
  const [showAddMember, setShowAddMember] = useState<boolean>(false);
  const [newMemberId, setNewMemberId] = useState<string>('');
  // 视图筛选班级：工作台级共享，跨子页保持一致（0 = 全部班级）
  const [filterClassId, setFilterClassId] = useWorkbenchClass();

  const fetchGroups = useCallback(async () => {
    setIsLoading(true);
    try {
      // 后端 /api/study-groups 支持 class_id 过滤，直接服务端筛选
      const data = await api.studyGroup.getAll(filterClassId || undefined);
      setGroups(data || []);
      setFormData((prev) => (prev.class_id > 0 ? prev : { ...prev, class_id: 0 }));
    } catch (error) {
      logger.error('获取学习小组列表失败:', error);
      showToast('error', '获取学习小组列表失败');
    } finally {
      setIsLoading(false);
    }
  }, [showToast, filterClassId]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const filteredGroups = groups.filter(
    (g) =>
      g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (g.description && g.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleOpenModal = useCallback(
    (isEdit = false, group?: StudyGroup) => {
      if (isEdit && group) {
        setFormData({
          id: group.id,
          class_id: group.class_id,
          name: group.name,
          leader_id: group.leader_id,
          description: group.description || '',
          member_ids: group.members?.map((m) => m.student_id) || [],
        });
      } else {
        // 新建默认带入当前筛选班级；未筛选（全部班级）时由 ClassSelect 自动默认第一项
        setFormData({ ...defaultGroupForm, class_id: filterClassId > 0 ? filterClassId : 0 });
      }
      setErrors({});
      setShowModal(true);
    },
    [filterClassId]
  );

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setFormData(defaultGroupForm);
    setErrors({});
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof GroupFormData, string>> = {};
    if (!formData.name.trim()) newErrors.name = '请输入小组名称';
    if (!formData.class_id || formData.class_id <= 0) newErrors.class_id = '请输入班级 ID';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;
    if (submitting) return; // M2: 防重复提交
    setSubmitting(true);

    try {
      if (formData.id) {
        await api.studyGroup.update(formData.id, {
          class_id: formData.class_id,
          name: formData.name,
          leader_id: formData.leader_id,
          description: formData.description,
        } as StudyGroupCreateInput);
        showToast('success', '小组更新成功');
      } else {
        await api.studyGroup.create({
          class_id: formData.class_id,
          name: formData.name,
          leader_id: formData.leader_id,
          description: formData.description,
          member_ids: formData.member_ids,
        });
        showToast('success', '小组创建成功');
      }
      handleCloseModal();
      fetchGroups();
    } catch (error) {
      logger.error('操作失败:', error);
      showToast('error', formData.id ? '更新小组失败' : '创建小组失败');
    } finally {
      setSubmitting(false);
    }
  }, [formData, showToast, handleCloseModal, fetchGroups, validateForm, submitting]);

  const handleDelete = useCallback(
    async (id: number) => {
      const ok = await confirmRef.current({
        message: '确定要删除这个学习小组吗？',
        confirmText: '确定',
        cancelText: '取消',
        type: 'danger',
      });
      if (!ok) return;
      try {
        await api.studyGroup.delete(id);
        showToast('success', '小组删除成功');
        fetchGroups();
        if (selectedGroup?.id === id) setSelectedGroup(null);
      } catch (error) {
        logger.error('删除失败:', error);
        showToast('error', '删除小组失败');
      }
    },
    [showToast, fetchGroups, selectedGroup]
  );

  const handleAddMember = useCallback(
    async (groupId: number, studentId: number) => {
      try {
        await api.studyGroup.addMember(groupId, studentId);
        showToast('success', '成员添加成功');
        setShowAddMember(false);
        setNewMemberId('');
        fetchGroups();
        if (selectedGroup?.id === groupId) {
          const updated = await api.studyGroup.getById(groupId);
          setSelectedGroup(updated);
        }
      } catch (error) {
        logger.error('添加成员失败:', error);
        showToast('error', '添加成员失败');
      }
    },
    [showToast, fetchGroups, selectedGroup]
  );

  const handleRemoveMember = useCallback(
    async (groupId: number, studentId: number) => {
      const ok = await confirmRef.current({
        message: '确定要移除该成员吗？',
        confirmText: '确定',
        cancelText: '取消',
        type: 'danger',
      });
      if (!ok) return;
      try {
        await api.studyGroup.removeMember(groupId, studentId);
        showToast('success', '成员移除成功');
        fetchGroups();
        if (selectedGroup?.id === groupId) {
          const updated = await api.studyGroup.getById(groupId);
          setSelectedGroup(updated);
        }
      } catch (error) {
        logger.error('移除成员失败:', error);
        showToast('error', '移除成员失败');
      }
    },
    [showToast, fetchGroups, selectedGroup]
  );

  const handleAddScore = useCallback(
    async (groupId: number) => {
      const change = Number(scoreAdjustValue);
      if (!change || isNaN(change)) {
        showToast('warning', '请输入有效的积分数值');
        return;
      }
      // M3: 分值边界校验，防止异常大额调整
      if (Math.abs(change) > 1000) {
        showToast('warning', '单次积分调整不能超过 ±1000');
        return;
      }
      try {
        await api.studyGroup.addScore(groupId, change, scoreReason);
        showToast('success', `积分${change > 0 ? '增加' : '减少'}成功`);
        setScoreAdjustValue('');
        setScoreReason('');
        fetchGroups();
        if (selectedGroup?.id === groupId) {
          const updated = await api.studyGroup.getById(groupId);
          setSelectedGroup(updated);
        }
      } catch (error) {
        logger.error('积分调整失败:', error);
        showToast('error', '积分调整失败');
      }
    },
    [scoreAdjustValue, scoreReason, showToast, fetchGroups, selectedGroup]
  );

  const totalGroups = groups.length;
  const totalMembers = groups.reduce((sum, g) => sum + (g.member_count || 0), 0); // 缺失字段按 0 计（列表已加载才统计）
  const totalScore = groups.reduce((sum, g) => sum + (g.score || 0), 0);
  const activeGroups = groups.filter((g) => g.is_active).length;

  return (
    <div className='flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
      <div className='px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 flex items-center justify-center shadow-lg shadow-purple-500/20'>
              <Users className='w-6 h-6 text-white' />
            </div>
            <div>
              <h1 className='text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text'>
                学习小组
              </h1>
              <p className='text-sm text-slate-500 dark:text-slate-400'>管理学习小组成员与积分</p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <div className='w-44'>
              <ClassSelect
                allowEmpty
                emptyLabel='全部班级'
                value={filterClassId}
                onChange={setFilterClassId}
              />
            </div>
            <WorkbenchBreadcrumb current='学习小组' />
            <CurrentClassLabel />
            <button
              onClick={() => handleOpenModal(false)}
              className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
            >
              <Plus className='w-5 h-5' />
              创建小组
            </button>
          </div>
        </div>
      </div>

      <div className='px-6 py-5'>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-5'>
          <StatCard
            label='小组总数'
            value={totalGroups}
            icon={<Users className='w-6 h-6 text-white' />}
            iconGradient='from-purple-500 to-pink-500'
            decoGradient='from-purple-500/10 to-pink-500/10'
            size='sm'
          />
          <StatCard
            label='成员总数'
            value={totalMembers}
            icon={<UserPlus className='w-6 h-6 text-white' />}
            iconGradient='from-blue-500 to-indigo-500'
            decoGradient='from-blue-500/10 to-indigo-500/10'
            size='sm'
          />
          <StatCard
            label='总积分'
            value={totalScore}
            icon={<Trophy className='w-6 h-6 text-white' />}
            iconGradient='from-amber-500 to-orange-500'
            decoGradient='from-amber-500/10 to-orange-500/10'
            size='sm'
          />
          <StatCard
            label='活跃小组'
            value={activeGroups}
            icon={<Target className='w-6 h-6 text-white' />}
            iconGradient='from-emerald-500 to-teal-500'
            decoGradient='from-emerald-500/10 to-teal-500/10'
            size='sm'
          />
        </div>
      </div>

      <div className='flex-1 px-6 pb-6'>
        <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden'>
          <div className='px-5 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-slate-50/50 to-white/50 dark:from-slate-800/50 dark:to-slate-800'>
            <div className='flex items-center gap-4'>
              <div className='relative flex-1 max-w-md'>
                <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400' />
                <input
                  type='text'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder='搜索小组名称或描述...'
                  aria-label='搜索小组名称或描述'
                  className='w-full pl-12 pr-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm'
                />
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className='px-5 py-16 text-center'>
              <LoadingSpinner text='加载中...' />
            </div>
          ) : filteredGroups.length === 0 ? (
            <EmptyState
              icon='users'
              title='暂无学习小组数据'
              description='还没有学习小组'
              actionLabel='创建第一个小组'
              onAction={() => handleOpenModal(false)}
            />
          ) : (
            <div className='p-5 grid grid-cols-1 md:grid-cols-2 gap-4'>
              {filteredGroups.map((group) => (
                <div
                  key={group.id}
                  className={`relative rounded-2xl border transition-all duration-300 cursor-pointer ${
                    selectedGroup?.id === group.id
                      ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-900/20 shadow-lg shadow-purple-500/10'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700'
                  }`}
                  onClick={() => setSelectedGroup(selectedGroup?.id === group.id ? null : group)}
                >
                  <div className='p-5'>
                    <div className='flex items-start justify-between mb-3'>
                      <div className='flex items-center gap-3'>
                        <div className='w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20'>
                          <Users className='w-6 h-6 text-white' />
                        </div>
                        <div>
                          <h3 className='font-bold text-slate-800 dark:text-slate-100'>
                            {group.name}
                          </h3>
                          <p className='text-xs text-slate-500 dark:text-slate-400'>
                            {group.class_name || `班级 #${group.class_id}`} ·{' '}
                            {group.member_count != null ? group.member_count : '--'} 名成员
                          </p>
                        </div>
                      </div>
                      <div className='flex items-center gap-1 opacity-60 group-hover:opacity-100'>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenModal(true, group);
                            }}
                            aria-label={`编辑小组 ${group.name}`}
                            className='p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all'
                          >
                            <Edit2 className='w-4 h-4' />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(group.id);
                            }}
                            aria-label={`删除小组 ${group.name}`}
                            className='p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all'
                          >
                            <Trash2 className='w-4 h-4' />
                          </button>
                      </div>
                    </div>

                    {group.description && (
                      <p className='text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2'>
                        {group.description}
                      </p>
                    )}

                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        <span className='inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-sm font-semibold'>
                          <Star className='w-4 h-4' />
                          {group.score}
                        </span>
                        {group.is_active ? (
                          <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'>
                            活跃
                          </span>
                        ) : (
                          <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'>
                            非活跃
                          </span>
                        )}
                      </div>
                      {group.leader_name && (
                        <span className='text-xs text-slate-500 dark:text-slate-400'>
                          组长: {group.leader_name}
                        </span>
                      )}
                    </div>

                    {selectedGroup?.id === group.id && (
                      <div className='mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3'>
                        <div>
                          <h4 className='text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1'>
                            <Sparkles className='w-4 h-4 text-purple-500' />
                            积分调整
                          </h4>
                          <div className='flex items-center gap-2'>
                            <input
                              type='number'
                              value={scoreAdjustValue}
                              onChange={(e) => setScoreAdjustValue(e.target.value)}
                              placeholder='+/- 分值'
                              aria-label='积分调整分值'
                              className='w-24 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50'
                            />
                            <input
                              type='text'
                              value={scoreReason}
                              onChange={(e) => setScoreReason(e.target.value)}
                              placeholder='原因（可选）'
                              aria-label='积分调整原因'
                              className='flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50'
                            />
                            <button
                              onClick={() => handleAddScore(group.id)}
                              className='px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm rounded-lg hover:shadow-md transition-all font-medium'
                            >
                              调整
                            </button>
                          </div>
                        </div>

                        <div>
                          <div className='flex items-center justify-between mb-2'>
                            <h4 className='text-sm font-semibold text-slate-700 dark:text-slate-300'>
                              成员管理 ({group.members ? group.members.length : '--'})
                            </h4>
                            <button
                              onClick={() => setShowAddMember(!showAddMember)}
                              className='flex items-center gap-1 text-xs text-purple-500 hover:text-purple-600 font-medium'
                            >
                              <UserPlus className='w-4 h-4' />
                              添加成员
                            </button>
                          </div>

                          {showAddMember && (
                            <div className='flex items-center gap-2 mb-2'>
                              <StudentSelect
                                value={newMemberId ? Number(newMemberId) : 0}
                                onChange={(id) => setNewMemberId(String(id))}
                                allowEmpty
                                emptyLabel='请选择学生'
                                className='flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-slate-800 dark:text-slate-100'
                              />
                              <button
                                onClick={() => {
                                  if (newMemberId) {
                                    handleAddMember(group.id, Number(newMemberId));
                                  }
                                }}
                                className='px-3 py-2 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600 transition-colors'
                              >
                                添加
                              </button>
                            </div>
                          )}

                          {group.members && group.members.length > 0 ? (
                            <div className='flex flex-wrap gap-2'>
                              {group.members.map((member: StudyGroupMember) => (
                                <div
                                  key={member.id}
                                  className='inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm'
                                >
                                  <span className='text-slate-700 dark:text-slate-300'>
                                    {member.student_name || `学生 #${member.student_id}`}
                                  </span>
                                    <button
                                      onClick={() => handleRemoveMember(group.id, member.student_id)}
                                      aria-label={`移除成员 ${member.student_name || `学生 #${member.student_id}`}`}
                                      className='text-slate-400 hover:text-red-500 transition-colors'
                                    >
                                      <UserMinus className='w-3.5 h-3.5' />
                                    </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className='text-xs text-slate-500 dark:text-slate-400'>暂无成员</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
          onClick={handleCloseModal}
        >
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center'>
                    <Users className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    {formData.id ? '编辑小组' : '创建小组'}
                  </h3>
                </div>
                <button
                  onClick={handleCloseModal}
                  aria-label='关闭小组编辑弹窗'
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>

            <div className='px-6 py-5 space-y-5'>
              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  小组名称 <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder='输入小组名称'
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all text-slate-800 dark:text-slate-100 ${
                    errors.name
                      ? 'border-red-500'
                      : 'border-slate-200 dark:border-slate-600 focus:border-purple-500'
                  }`}
                />
                {errors.name && <p className='mt-1 text-xs text-red-500'>{errors.name}</p>}
              </div>

              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder='输入小组描述（可选）'
                  rows={3}
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all resize-none text-slate-800 dark:text-slate-100'
                />
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    班级 <span className='text-red-500'>*</span>
                  </label>
                  <ClassSelect
                    value={formData.class_id}
                    onChange={(id) => setFormData((prev) => ({ ...prev, class_id: id }))}
                    disabled={!!formData.id}
                    emptyPlaceholder='暂无班级'
                    className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all text-slate-800 dark:text-slate-100 disabled:opacity-60 ${
                      errors.class_id
                        ? 'border-red-500'
                        : 'border-slate-200 dark:border-slate-600 focus:border-purple-500'
                    }`}
                  />
                  {errors.class_id && (
                    <p className='mt-1 text-xs text-red-500'>{errors.class_id}</p>
                  )}
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    组长
                  </label>
                  <StudentSelect
                    value={formData.leader_id ?? 0}
                    onChange={(id) =>
                      setFormData((prev) => ({ ...prev, leader_id: id || undefined }))
                    }
                    allowEmpty
                    emptyLabel='不指定组长'
                  />
                </div>
              </div>
            </div>

            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3'>
              <button
                onClick={handleCloseModal}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed'
              >
                <Check className='w-5 h-5' />
                {submitting ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudyGroups;
