import { getErrMsg } from '../utils/getErrMsg';
import logger from '../utils/logger';
import { useState, useCallback, useRef } from 'react';
import api from '../services/api';
import type { ClassCommittee, CommitteeCreateInput, CommitteeTerm } from '../types';
import { useStableToast, useSubmitGuard, useWorkbenchClass, useListData } from '../hooks';
import { useConfirm } from '../components';
import CommitteeListView, {
  CommitteeFormData,
  TermFormData,
} from './committeeList/CommitteeListView';

const defaultForm: CommitteeFormData = {
  position: 'monitor',
  // 0 = 未选择，交给 ClassSelect 自动默认第一个班级
  class_id: 0,
  student_id: 0,
  responsibilities: '',
  term_start: new Date().toISOString().split('T')[0],
  term_end: '',
};

const defaultTermForm: TermFormData = {
  term_name: '',
  start_date: '',
  end_date: '',
  is_current: false,
};

function CommitteeListPage() {
  const [showFormModal, setShowFormModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CommitteeFormData>(defaultForm);
  // 任期管理（P1 修复：后端 /api/committee/terms 已存在，此前页面未接线）
  const [showTermModal, setShowTermModal] = useState(false);
  const [terms, setTerms] = useState<CommitteeTerm[]>([]);
  const [termsLoading, setTermsLoading] = useState(false);
  const [termForm, setTermForm] = useState<TermFormData>(defaultTermForm);
  // 视图筛选班级：工作台级共享，跨子页保持一致（0 = 全部班级）
  const [filterClassId, setFilterClassId] = useWorkbenchClass();
  const { showToast } = useStableToast();
  const { run: runSubmit } = useSubmitGuard();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;

  const {
    data: committee,
    loading: isLoading,
    refetch: fetchCommittee,
  } = useListData<ClassCommittee>({
    fetcher: () => api.committee.getAll(filterClassId || undefined),
    deps: [filterClassId],
    debounceDelay: 0,
    onError: (e) => {
      logger.error('获取班委名单失败:', e);
      showToast('error', '获取班委名单失败');
    },
  });

  const openCreateModal = useCallback(() => {
    setEditingId(null);
    // 新建默认带入当前筛选班级；未筛选（全部班级）时由 ClassSelect 自动默认第一项
    setFormData({ ...defaultForm, class_id: filterClassId > 0 ? filterClassId : 0 });
    setShowFormModal(true);
  }, [filterClassId]);

  // ==== 任期管理（P1 接线）====
  const fetchTerms = useCallback(async () => {
    setTermsLoading(true);
    try {
      const data = await api.committee.getTerms(filterClassId || undefined);
      setTerms(data || []);
    } catch (error) {
      logger.error('获取班委任期失败:', error);
      showToast('error', getErrMsg(error, '获取班委任期失败'));
    } finally {
      setTermsLoading(false);
    }
  }, [filterClassId, showToast]);

  const openTermModal = useCallback(() => {
    setTermForm(defaultTermForm);
    setShowTermModal(true);
    fetchTerms();
  }, [fetchTerms]);

  const handleCreateTerm = useCallback(async () => {
    if (!filterClassId) {
      showToast('warning', '请先选择班级');
      return;
    }
    if (!termForm.term_name.trim()) {
      showToast('warning', '请输入任期名称');
      return;
    }
    setTermsLoading(true);
    try {
      await api.committee.createTerm({
        class_id: filterClassId,
        term_name: termForm.term_name.trim(),
        start_date: termForm.start_date || undefined,
        end_date: termForm.end_date || undefined,
        is_current: termForm.is_current,
      });
      showToast('success', '任期创建成功');
      setTermForm(defaultTermForm);
      fetchTerms();
    } catch (error) {
      logger.error('创建任期失败:', error);
      showToast('error', getErrMsg(error, '创建任期失败'));
    } finally {
      setTermsLoading(false);
    }
  }, [filterClassId, termForm, showToast, fetchTerms]);

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
      showToast('warning', '请选择学生');
      return;
    }
    if (!formData.class_id) {
      showToast('warning', '请选择班级');
      return;
    }
    setIsSubmitting(true);
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
      showToast('error', getErrMsg(error, editingId ? '更新班委失败' : '添加班委失败'));
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, editingId, showToast, fetchCommittee]);

  const handleDelete = useCallback(
    async (id: number) => {
      const ok = await confirmRef.current({
        title: '删除确认',
        message: '确定要删除这条班委记录吗？',
        confirmText: '删除',
        type: 'danger',
      });
      if (!ok) return;
      setIsSubmitting(true);
      try {
        await api.committee.delete(id);
        showToast('success', '班委记录删除成功');
        fetchCommittee();
      } catch (error) {
        logger.error('删除失败:', error);
        showToast('error', getErrMsg(error, '删除班委记录失败'));
      } finally {
        setIsSubmitting(false);
      }
    },
    [showToast, fetchCommittee]
  );

  const activeCount = committee.filter((c) => c.is_active).length;
  const ratedCount = committee.filter((c) => c.rating && c.rating > 0).length;

  return (
    <CommitteeListView
      committee={committee}
      isLoading={isLoading}
      terms={terms}
      termsLoading={termsLoading}
      termForm={termForm}
      formData={formData}
      showFormModal={showFormModal}
      showTermModal={showTermModal}
      editingId={editingId}
      filterClassId={filterClassId}
      isSubmitting={isSubmitting}
      setFilterClassId={setFilterClassId}
      openCreateModal={openCreateModal}
      openTermModal={openTermModal}
      openEditModal={openEditModal}
      handleSubmit={handleSubmit}
      handleDelete={handleDelete}
      handleCreateTerm={handleCreateTerm}
      setFormData={setFormData}
      setTermForm={setTermForm}
      setShowFormModal={setShowFormModal}
      setShowTermModal={setShowTermModal}
      runSubmit={runSubmit}
      activeCount={activeCount}
      ratedCount={ratedCount}
    />
  );
}

export default CommitteeListPage;
