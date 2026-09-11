import { getErrMsg } from '../utils/getErrMsg';
import logger from '../utils/logger';
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { useStableToast, useSubmitGuard, useWorkbenchClass } from '../hooks';
import { useConfirm } from '../components';
import { StudyGroup, StudyGroupCreateInput } from '../types';
import StudyGroupsView, {
  GroupFormData,
  GroupFormErrors,
  defaultGroupForm,
} from './studyGroups/StudyGroupsView';

function StudyGroups() {
  const { showToast } = useStableToast();
  const { run: runSubmit } = useSubmitGuard();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formData, setFormData] = useState<GroupFormData>(defaultGroupForm);
  const [errors, setErrors] = useState<GroupFormErrors>({});
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
      showToast('error', getErrMsg(error, '获取学习小组列表失败'));
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
    const newErrors: GroupFormErrors = {};
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
      showToast('error', getErrMsg(error, formData.id ? '更新小组失败' : '创建小组失败'));
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
        showToast('error', getErrMsg(error, '删除小组失败'));
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
        showToast('error', getErrMsg(error, '添加成员失败'));
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
        showToast('error', getErrMsg(error, '移除成员失败'));
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
        showToast('error', getErrMsg(error, '积分调整失败'));
      }
    },
    [scoreAdjustValue, scoreReason, showToast, fetchGroups, selectedGroup]
  );

  const totalGroups = groups.length;
  const totalMembers = groups.reduce((sum, g) => sum + (g.member_count || 0), 0); // 缺失字段按 0 计（列表已加载才统计）
  const totalScore = groups.reduce((sum, g) => sum + (g.score || 0), 0);
  const activeGroups = groups.filter((g) => g.is_active).length;

  return (
    <StudyGroupsView
      groups={groups}
      isLoading={isLoading}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      filteredGroups={filteredGroups}
      totalGroups={totalGroups}
      totalMembers={totalMembers}
      totalScore={totalScore}
      activeGroups={activeGroups}
      showModal={showModal}
      handleCloseModal={handleCloseModal}
      submitting={submitting}
      runSubmit={runSubmit}
      handleSubmit={handleSubmit}
      formData={formData}
      setFormData={setFormData}
      errors={errors}
      setErrors={setErrors}
      selectedGroup={selectedGroup}
      setSelectedGroup={setSelectedGroup}
      scoreAdjustValue={scoreAdjustValue}
      setScoreAdjustValue={setScoreAdjustValue}
      scoreReason={scoreReason}
      setScoreReason={setScoreReason}
      showAddMember={showAddMember}
      setShowAddMember={setShowAddMember}
      newMemberId={newMemberId}
      setNewMemberId={setNewMemberId}
      filterClassId={filterClassId}
      setFilterClassId={setFilterClassId}
      handleOpenModal={handleOpenModal}
      handleDelete={handleDelete}
      handleAddMember={handleAddMember}
      handleRemoveMember={handleRemoveMember}
      handleAddScore={handleAddScore}
    />
  );
}

export default StudyGroups;
