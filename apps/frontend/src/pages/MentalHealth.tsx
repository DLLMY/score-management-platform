import { getErrMsg } from '../utils/getErrMsg';
import logger from '../utils/logger';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import {
  useStableToast,
  useSubmitGuard,
  useWorkbenchClass,
  useListData,
  useClientFilter,
} from '../hooks';
import { MentalHealthRecord, MentalHealthAlert, MentalHealthRecordCreateInput } from '../types';
import MentalHealthView, {
  RecordFormData,
  defaultRecordForm,
} from './mentalHealth/MentalHealthView';

function MentalHealth() {
  const { showToast } = useStableToast();
  const { run: runSubmit } = useSubmitGuard();
  const [alerts, setAlerts] = useState<MentalHealthAlert[] | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState<boolean>(false);
  const [formData, setFormData] = useState<RecordFormData>(defaultRecordForm);
  const [errors, setErrors] = useState<Partial<Record<keyof RecordFormData, string>>>({});
  // C-2：支持从总览「未处理预警」下钻 ?view=alerts&resolved=0 预置
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'records' | 'alerts'>(() =>
    searchParams.get('view') === 'alerts' ? 'alerts' : 'records'
  );
  const [resolvedFilter, setResolvedFilter] = useState<boolean | undefined>(() => {
    const v = searchParams.get('resolved');
    return v === '1' ? true : v === '0' ? false : undefined;
  });
  const [submitting, setSubmitting] = useState<boolean>(false);
  // M9 P1: 服务端分页状态（记录列表 + 预警列表）
  const [recordPage, setRecordPage] = useState(1);
  const [recordTotal, setRecordTotal] = useState(0);
  const [alertPage, setAlertPage] = useState(1);
  const [alertTotal, setAlertTotal] = useState(0);
  // 视图筛选班级：工作台级共享，跨子页保持一致（0 = 全部班级）
  // 心理健康属隐私数据，筛选范围由后端 class_id 隔离（见 mental_health_service.list_records）
  const [filterClassId, setFilterClassId] = useWorkbenchClass();
  const {
    data: records,
    loading: isLoading,
    refetch: fetchRecords,
  } = useListData<MentalHealthRecord>({
    fetcher: async () => {
      // M9 P1: 服务端分页信封（records 资源 key）
      const resp = await api.mentalHealth.getRecords(undefined, filterClassId || undefined, {
        page: recordPage,
        per_page: 50,
      });
      setRecordTotal(resp.total);
      return resp.records || [];
    },
    deps: [filterClassId, recordPage],
    debounceDelay: 0,
    onError: (e) => {
      logger.error('获取心理健康记录失败:', e);
      showToast('error', '获取心理健康记录失败');
    },
  });

  const fetchAlerts = useCallback(async () => {
    try {
      // M9 P1: 服务端分页信封（alerts 资源 key）
      const resp = await api.mentalHealth.getAlerts(
        undefined,
        resolvedFilter,
        filterClassId || undefined,
        { page: alertPage, per_page: 50 }
      );
      setAlerts(resp.alerts || []);
      setAlertTotal(resp.total);
    } catch (error) {
      logger.error('获取预警列表失败:', error);
      setAlerts(null); // 加载失败：不伪装成"已处理"或"无预警"
      showToast('error', getErrMsg(error, '获取预警列表失败，请稍后重试'));
    }
  }, [showToast, filterClassId, alertPage, resolvedFilter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // M9 P1: 切换班级筛选时重置记录/预警分页到首页
  useEffect(() => {
    setRecordPage(1);
    setAlertPage(1);
  }, [filterClassId]);

  // C-2: 切换处理状态过滤时回到预警第一页
  useEffect(() => {
    setAlertPage(1);
  }, [resolvedFilter]);

  const filteredRecords = useClientFilter(
    records,
    (r) =>
      (r.student_name && r.student_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.notes && r.notes.toLowerCase().includes(searchTerm.toLowerCase())),
    [searchTerm]
  );

  const unresolvedAlerts = (alerts || []).filter((a) => !a.is_resolved);
  const resolvedAlerts = (alerts || []).filter((a) => a.is_resolved);

  const handleOpenForm = useCallback(() => {
    // 表单不绑定班级（学生本身属于班级），仅重置为学生下拉自动默认第一项
    setFormData(defaultRecordForm);
    setErrors({});
    setShowForm(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setShowForm(false);
    setFormData(defaultRecordForm);
    setErrors({});
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof RecordFormData, string>> = {};
    if (!formData.student_id || formData.student_id <= 0) newErrors.student_id = '请选择学生';
    if (formData.mood_level < 1 || formData.mood_level > 5)
      newErrors.mood_level = '心情等级需在 1-5 之间';
    if (formData.stress_level < 1 || formData.stress_level > 5)
      newErrors.stress_level = '压力等级需在 1-5 之间';
    if (formData.sleep_hours < 0 || formData.sleep_hours > 24)
      newErrors.sleep_hours = '睡眠小时数需在 0-24 之间';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;
    if (submitting) return; // M2: 防重复提交
    setSubmitting(true);
    try {
      const data: MentalHealthRecordCreateInput = {
        student_id: formData.student_id,
        mood_level: formData.mood_level,
        stress_level: formData.stress_level,
        sleep_hours: formData.sleep_hours,
        notes: formData.notes,
      };
      await api.mentalHealth.createRecord(data);
      showToast('success', '心理健康记录创建成功');
      handleCloseForm();
      fetchRecords();
      fetchAlerts();
    } catch (error) {
      logger.error('创建记录失败:', error);
      showToast('error', getErrMsg(error, '创建记录失败'));
    } finally {
      setSubmitting(false);
    }
  }, [formData, showToast, handleCloseForm, fetchRecords, fetchAlerts, validateForm, submitting]);

  const handleResolveAlert = useCallback(
    async (alertId: number) => {
      try {
        await api.mentalHealth.resolveAlert(alertId);
        showToast('success', '预警已解决');
        fetchAlerts();
      } catch (error) {
        logger.error('解决预警失败:', error);
        showToast('error', getErrMsg(error, '解决预警失败'));
      }
    },
    [showToast, fetchAlerts]
  );

  const avgMood =
    records.length > 0
      ? (records.reduce((sum, r) => sum + (r.mood_level || 0), 0) / records.length).toFixed(1)
      : '—';
  const avgStress =
    records.length > 0
      ? (records.reduce((sum, r) => sum + (r.stress_level || 0), 0) / records.length).toFixed(1)
      : '—';
  const avgSleep =
    records.length > 0
      ? (records.reduce((sum, r) => sum + (r.sleep_hours || 0), 0) / records.length).toFixed(1)
      : '—';

  return (
    <MentalHealthView
      records={records}
      isLoading={isLoading}
      alerts={alerts}
      filteredRecords={filteredRecords}
      unresolvedAlerts={unresolvedAlerts}
      resolvedAlerts={resolvedAlerts}
      avgMood={avgMood}
      avgStress={avgStress}
      avgSleep={avgSleep}
      recordTotal={recordTotal}
      alertTotal={alertTotal}
      recordPage={recordPage}
      alertPage={alertPage}
      activeTab={activeTab}
      resolvedFilter={resolvedFilter}
      searchTerm={searchTerm}
      filterClassId={filterClassId}
      showForm={showForm}
      formData={formData}
      errors={errors}
      submitting={submitting}
      setSearchTerm={setSearchTerm}
      setActiveTab={setActiveTab}
      setResolvedFilter={setResolvedFilter}
      setRecordPage={setRecordPage}
      setAlertPage={setAlertPage}
      setFilterClassId={setFilterClassId}
      setFormData={setFormData}
      handleOpenForm={handleOpenForm}
      handleCloseForm={handleCloseForm}
      handleSubmit={handleSubmit}
      handleResolveAlert={handleResolveAlert}
      runSubmit={runSubmit}
    />
  );
}

export default MentalHealth;
