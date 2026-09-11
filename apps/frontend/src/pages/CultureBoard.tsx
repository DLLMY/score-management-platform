import { getErrMsg } from '../utils/getErrMsg';
import logger from '../utils/logger';
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import {
  useStableToast,
  useSubmitGuard,
  useWorkbenchClass,
  useListData,
  useClientFilter,
} from '../hooks';
import { CultureRecord, CultureCreateInput } from '../types';
import { useConfirm } from '../components';
import CultureBoardView, {
  type CultureFormData,
  defaultCultureForm,
  cultureCategories,
} from './cultureBoard/CultureBoardView';

function CultureBoard() {
  // 视图筛选班级：工作台级共享，跨子页保持一致（0 = 全部班级）
  const [filterClassId, setFilterClassId] = useWorkbenchClass();
  // 弹窗表单绑定班级：页面本地，与视图筛选严格分离
  const [selectedClassId, setSelectedClassId] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('全部');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [formData, setFormData] = useState<CultureFormData>(defaultCultureForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  // M9 P1: 文化记录列表服务端分页状态
  const [culturePage, setCulturePage] = useState(1);
  const [cultureTotal, setCultureTotal] = useState(0);

  const { showToast } = useStableToast();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;
  const { submitting, run: runSubmit } = useSubmitGuard();
  const {
    data: records,
    loading: isLoading,
    refetch: fetchRecords,
  } = useListData<CultureRecord>({
    fetcher: async () => {
      // M9 P1: 服务端分页信封（records 资源 key）
      const resp = await api.culture.getAll(undefined, undefined, {
        page: culturePage,
        per_page: 50,
      });
      setCultureTotal(resp.total);
      return resp.records || [];
    },
    deps: [culturePage],
    debounceDelay: 0,
    onError: (e) => {
      logger.error('获取班级文化记录失败:', e);
      showToast('error', '获取班级文化记录失败');
    },
  });

  // M9 P1: 切换班级筛选时重置文化记录分页到首页
  useEffect(() => {
    setCulturePage(1);
  }, [filterClassId]);

  const filteredRecords = useClientFilter(
    records,
    (r) => {
      const matchSearch =
        !searchTerm ||
        r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.content?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = activeCategory === '全部' || r.category === activeCategory;
      // 班级筛选联动（0 = 全部班级）；视图筛选与新建表单的班级选择解耦
      const matchClass = filterClassId === 0 || r.class_id === filterClassId;
      return matchSearch && matchCategory && matchClass;
    },
    [searchTerm, activeCategory, filterClassId]
  ).sort((a, b) => a.display_order - b.display_order);

  const groupedRecords = cultureCategories.slice(1).reduce((acc, cat) => {
    acc[cat] = filteredRecords.filter((r) => r.category === cat);
    return acc;
  }, {} as Record<string, CultureRecord[]>);

  const handleOpenCreate = useCallback(() => {
    setFormData(defaultCultureForm);
    setFormErrors({});
    // 新建默认带入当前筛选班级；未筛选（全部班级）时由 ClassSelect 自动默认第一项
    setSelectedClassId(filterClassId > 0 ? filterClassId : 0);
    setShowModal(true);
  }, [filterClassId]);

  const handleOpenEdit = useCallback((record: CultureRecord) => {
    setSelectedClassId(record.class_id ?? 0);
    setFormData({
      id: record.id,
      category: record.category || '标语',
      title: record.title || '',
      content: record.content || '',
      image_url: record.image_url || '',
      display_order: record.display_order,
      is_active: record.is_active,
    });
    setFormErrors({});
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setFormData(defaultCultureForm);
    setFormErrors({});
  }, []);

  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.content?.trim()) {
      errors.content = '内容不能为空';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;
    if (!formData.id && !selectedClassId) {
      showToast('error', '请先选择班级');
      return;
    }

    try {
      const payload: CultureCreateInput = {
        class_id: formData.id ? undefined : selectedClassId,
        category: formData.category || undefined,
        title: formData.title || undefined,
        content: formData.content,
        image_url: formData.image_url || undefined,
        display_order: formData.display_order,
      };

      if (formData.id) {
        await api.culture.update(formData.id, payload);
        showToast('success', '记录更新成功');
      } else {
        await api.culture.create(payload);
        showToast('success', '记录创建成功');
      }
      handleCloseModal();
      fetchRecords();
    } catch (error) {
      logger.error('保存记录失败:', error);
      showToast('error', getErrMsg(error, formData.id ? '更新记录失败' : '创建记录失败'));
    }
  }, [formData, validateForm, showToast, handleCloseModal, fetchRecords, selectedClassId]);

  const handleDelete = useCallback(
    async (id: number) => {
      const ok = await confirmRef.current({
        message: '确定要删除这条记录吗？',
        confirmText: '确定',
        cancelText: '取消',
        type: 'danger',
      });
      if (!ok) return;
      try {
        await api.culture.delete(id);
        showToast('success', '记录删除成功');
        fetchRecords();
      } catch (error) {
        logger.error('删除记录失败:', error);
        showToast('error', getErrMsg(error, '删除记录失败'));
      }
    },
    [showToast, fetchRecords]
  );

  const handleMoveOrder = useCallback(
    async (id: number, direction: 'up' | 'down') => {
      const record = records.find((r) => r.id === id);
      if (!record) return;

      const sortedRecords = [...records].sort((a, b) => a.display_order - b.display_order);
      const currentIndex = sortedRecords.findIndex((r) => r.id === id);
      const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      if (swapIndex < 0 || swapIndex >= sortedRecords.length) return;

      const swapRecord = sortedRecords[swapIndex];
      const newOrder = swapRecord.display_order;

      try {
        await api.culture.update(id, { display_order: newOrder });
        await api.culture.update(swapRecord.id, { display_order: record.display_order });
        showToast('success', '排序已更新');
        fetchRecords();
      } catch (error) {
        logger.error('更新排序失败:', error);
        showToast('error', getErrMsg(error, '更新排序失败'));
      }
    },
    [records, showToast, fetchRecords]
  );

  const handleChange = useCallback(
    (field: keyof CultureFormData, value: string | number | boolean) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSubmitModal = () => {
    runSubmit(handleSubmit);
  };

  return (
    <CultureBoardView
      activeCategory={activeCategory}
      groupedRecords={groupedRecords}
      isLoading={isLoading}
      culturePage={culturePage}
      cultureTotal={cultureTotal}
      setCulturePage={setCulturePage}
      filterClassId={filterClassId}
      setFilterClassId={setFilterClassId}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      setActiveCategory={setActiveCategory}
      selectedClassId={selectedClassId}
      setSelectedClassId={setSelectedClassId}
      submitting={submitting}
      showModal={showModal}
      formData={formData}
      formErrors={formErrors}
      onOpenCreate={handleOpenCreate}
      onOpenEdit={handleOpenEdit}
      onCloseModal={handleCloseModal}
      onSubmit={handleSubmitModal}
      onDelete={handleDelete}
      onMoveOrder={handleMoveOrder}
      onChange={handleChange}
    />
  );
}

export default CultureBoard;
