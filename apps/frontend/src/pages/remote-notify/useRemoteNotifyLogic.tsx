/* eslint-disable react-hooks/exhaustive-deps */
/**
 * 远程通知页的逻辑层 hook（状态 / effect / loader / deps 装配）。
 * T12-10c 拆分（2026-09-12）：16 个用户行为回调外提至 useRemoteNotifyHandlers（拆法 C），
 * 本文件退化为「组合根 + deps 装配」，行为逐字节等价。
 */

import logger from '../../utils/logger';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import api, { NotifyTemplate, ScheduledNotify, NotifyHistory } from '../../services/api';
import {
  useForm,
  useModal,
  useClassNowStatus,
  useAutoSave,
  useStableToast,
  useListData,
  useListFetch,
  useOptimizedFetch,
} from '../../hooks';
import type { BlockScope } from '../../hooks';
import { useConfirm, type ColumnType } from '../../components';
import { buildHistoryColumns } from './columns';
import {
  DEFAULT_NOTIFY_FORM,
  DEFAULT_SCORE_FORM,
  DEFAULT_SCHEDULED_FORM,
  DEFAULT_TEMPLATE_FORM,
  type NotifyForm,
  type NotifyMode,
  type PreviewConfirmState,
  type ScoreChangeForm,
  type ScheduledFormData,
  type TemplateFormData,
  type RemoteNotifyDraft,
  type SendResult,
  type HistoryStats,
  type RemoteNotifyDeps,
} from './types';
import { useRemoteNotifyHandlers, type RemoteNotifySharedDeps } from './useRemoteNotifyHandlers';

function isDraftMeaningful(d: RemoteNotifyDraft): boolean {
  return (
    d.form.text.trim() !== '' ||
    d.form.device_id.trim() !== '' ||
    d.scoreForm.student_name.trim() !== '' ||
    d.scheduledForm.text.trim() !== '' ||
    d.scheduledForm.scheduled_at !== ''
  );
}

/**
 * 远程通知页逻辑 hook。
 */
export function useRemoteNotifyLogic() {
  const { showToast } = useStableToast();
  const [mode, setMode] = useState<NotifyMode>('broadcast');
  const [isSending, setIsSending] = useState(false);
  const [lastResult, setLastResult] = useState<SendResult | null>(null);
  const [mqttConnected, setMqttConnected] = useState<boolean | null>(null);
  // 强制发送开关（受 notification.force_send 权限门控，仅超管可见复选框）
  const [forceSend, setForceSend] = useState(false);
  const [scheduledForceSend, setScheduledForceSend] = useState(false);
  // M6: 发送前预览确认弹窗（null=关闭）
  const [previewConfirm, setPreviewConfirm] = useState<PreviewConfirmState | null>(null);
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;

  // 使用 useForm 管理表单状态
  const { formData: form, setFormData: setForm } = useForm<NotifyForm>(DEFAULT_NOTIFY_FORM, {
    text: { required: true, minLength: 1 },
  });

  const { formData: scoreForm, setFormData: setScoreForm } = useForm<ScoreChangeForm>(
    DEFAULT_SCORE_FORM,
    {
      student_name: { required: true, minLength: 1 },
    }
  );

  // 模板相关状态
  const [editingTemplate, setEditingTemplate] = useState<NotifyTemplate | null>(null);
  // 数据加载失败标记（模板/定时/历史任一失败置位，页面显示警示条而非空态误导）
  const [loadError, setLoadError] = useState(false);

  // 班级实时上课状态（用于下发前的拦截提示；scope 必须对应后端判定口径）
  const nowDeviceId =
    mode === 'device' ? form.device_id : mode === 'score_change' ? scoreForm.device_id : undefined;
  const nowScope: BlockScope =
    mode === 'broadcast' ? 'broadcast' : nowDeviceId ? 'class' : 'global';
  const classNow = useClassNowStatus(undefined, {
    scope: nowScope,
    deviceId: nowDeviceId || undefined,
  });
  // 定时通知「立即发送」的实时状态（定时项可能为广播或指定设备，后端按各自目标强拦截，这里用广播口径作提示）
  const scheduledClassNow = useClassNowStatus(undefined, { scope: 'broadcast' });

  const {
    formData: templateForm,
    setFormData: setTemplateForm,
    resetForm: resetTemplateForm,
  } = useForm<TemplateFormData>(DEFAULT_TEMPLATE_FORM, {
    name: { required: true, minLength: 1 },
    text: { required: true, minLength: 1 },
  });

  // 使用 useModal 管理弹窗状态
  const {
    isOpen: showTemplateModal,
    open: openTemplateModal,
    close: closeTemplateModal,
  } = useModal<NotifyTemplate | null>({
    onClose: () => {
      resetTemplateForm();
      setEditingTemplate(null);
    },
  });

  // 历史记录
  const [historyPage, setHistoryPage] = useState(1);
  const [historyFilter, setHistoryFilter] = useState<string>('');

  const { isOpen: showHistory, open: openHistory, close: closeHistory } = useModal<null>({});

  // 定时通知相关状态
  const [scheduledPage, setScheduledPage] = useState(1);
  const scheduledPerPage = 50;
  const [editingScheduled, setEditingScheduled] = useState<ScheduledNotify | null>(null);

  const {
    formData: scheduledForm,
    setFormData: setScheduledForm,
    resetForm: resetScheduledForm,
  } = useForm<ScheduledFormData>(DEFAULT_SCHEDULED_FORM, {
    text: { required: true, minLength: 1 },
    scheduled_at: { required: true, minLength: 1 },
  });

  const {
    isOpen: showScheduledModal,
    open: openScheduledModal,
    close: closeScheduledModal,
  } = useModal<ScheduledNotify | null>({
    onClose: () => {
      resetScheduledForm();
      setEditingScheduled(null);
    },
  });

  // M3: 远程通知本地草稿——发送表单/积分表单/定时表单，中途刷新可恢复
  const draftData = useMemo<RemoteNotifyDraft>(
    () => ({
      mode,
      form,
      scoreForm,
      scheduledForm,
      activeScheduledModal: showScheduledModal,
    }),
    [mode, form, scoreForm, scheduledForm, showScheduledModal]
  );

  const { draftAvailable, loadDraft, restoreDraft, discardChanges, clearDraft } =
    useAutoSave<RemoteNotifyDraft>({
      key: 'remote-notify',
      data: draftData,
    });

  // 空草稿静默清理：无实质内容时不弹恢复条
  useEffect(() => {
    if (!draftAvailable) return;
    const d = loadDraft();
    if (d && !isDraftMeaningful(d)) {
      clearDraft();
    }
  }, [draftAvailable, loadDraft, clearDraft]);

  // A 轨：模板为全量列表 → useListData（data 恒数组，免判空）
  const templates = useListData<NotifyTemplate>({
    fetcher: async () => {
      try {
        const data = await api.notifyTemplates.getAll();
        setLoadError(false);
        return data ?? [];
      } catch (error) {
        logger.error('加载模板失败:', error);
        setLoadError(true);
        throw error;
      }
    },
  });
  // 既有着儿/删除后刷新路径仍以 loadTemplates 命名调用（语义 = 重新拉取）
  const loadTemplates = useCallback(async (): Promise<void> => {
    await templates.refetch();
  }, [templates]);

  // A 轨：定时通知列表迁 useListFetch（服务端分页，Array/信封两种形态兼容保留）
  const scheduled = useListFetch<ScheduledNotify>({
    params: { page: scheduledPage, pageSize: scheduledPerPage },
    fetcher: async ({ page, pageSize }) => {
      try {
        const data = await api.scheduledNotify.getAll({ page, per_page: pageSize });
        const list = Array.isArray(data) ? (data as ScheduledNotify[]) : data?.items ?? [];
        setLoadError(false);
        return { items: list, total: (data as { total?: number })?.total ?? list.length };
      } catch (error) {
        logger.error('加载定时通知失败:', error);
        setLoadError(true);
        throw error;
      }
    },
  });
  // 既有增删改后刷新路径仍以 loadScheduledNotifications 命名调用（语义 = 重新拉取当前页）
  const loadScheduledNotifications = useCallback(async (): Promise<void> => {
    await scheduled.refetch();
  }, [scheduled]);

  // A 轨：历史记录列表迁 useListFetch（enabled 跟随 showHistory，打开弹窗才拉取）
  const historyList = useListFetch<NotifyHistory>({
    enabled: showHistory,
    params: { page: historyPage, pageSize: 20, status: historyFilter || undefined },
    fetcher: async ({ page, pageSize, status }) => {
      try {
        const result = await api.notifyHistory.getAll({
          page,
          per_page: pageSize,
          ...(typeof status === 'string' && status ? { status } : {}),
        });
        setLoadError(false);
        // M7: 数组赋值防护，非数组时置空避免渲染崩溃
        const list = Array.isArray(result?.data) ? result.data : [];
        return { items: list, total: result?.total ?? list.length };
      } catch (error) {
        logger.error('加载历史记录失败:', error);
        setLoadError(true);
        throw error;
      }
    },
  });

  // 历史统计为标量（非列表），用 useOptimizedFetch 同款 enabled 语义按需加载
  const historyStatsFetch = useOptimizedFetch<HistoryStats | null>(
    async () => {
      try {
        const stats = await api.notifyHistory.getStats();
        setLoadError(false);
        return stats;
      } catch (error) {
        logger.error('加载统计数据失败:', error);
        setLoadError(true);
        throw error;
      }
    },
    [],
    { enabled: showHistory, initialData: null }
  );

  // 保持对外（deps / HistoryPanel）字段名不变，子组件零改动
  const historyData = historyList.items;
  const historyTotal = historyList.total;
  const isLoadingHistory = historyList.loading;
  const historyStats = historyStatsFetch.data;

  // ---- T12-10c 拆分：16 个用户行为回调外提至 useRemoteNotifyHandlers（拆法 C）----
  const shared: RemoteNotifySharedDeps = {
    showToast,
    mode,
    setMode,
    setIsSending,
    setLastResult,
    setMqttConnected,
    forceSend,
    scheduledForceSend,
    setPreviewConfirm,
    confirmRef,
    form,
    setForm,
    scoreForm,
    setScoreForm,
    templateForm,
    editingTemplate,
    loadTemplates,
    closeTemplateModal,
    loadScheduledNotifications,
    scheduledForm,
    setScheduledForm,
    openScheduledModal,
    closeScheduledModal,
    editingScheduled,
    setEditingScheduled,
    clearDraft,
    restoreDraft,
    discardChanges,
    historyList,
    historyStatsFetch,
  };
  const handlers = useRemoteNotifyHandlers(shared);
  const {
    handleRestoreDraft,
    handleDiscardDraft,
    checkMqttStatus,
    handleCleanHistory,
    performSend,
    handleSubmit,
    handleReset,
    handleUseTemplate,
    handleUsePreset,
    handleSaveTemplate,
    handleDeleteTemplate,
    handleSaveScheduled,
    handleDeleteScheduled,
    handleCancelScheduled,
    handleTriggerScheduled,
    handleUseCurrentFormForScheduled,
  } = handlers;

  useEffect(() => {
    checkMqttStatus();
  }, [checkMqttStatus]);

  const historyColumns = useMemo<ColumnType<NotifyHistory>[]>(() => buildHistoryColumns(), []);

  // 装配强类型 deps 透传给各子模块（拆分模式与 NLPManagement 一致）
  const deps: RemoteNotifyDeps = {
    mode,
    setMode,
    isSending,
    lastResult,
    form,
    setForm,
    scoreForm,
    setScoreForm,
    forceSend,
    setForceSend,
    previewConfirm,
    setPreviewConfirm,
    classNow,
    handleSubmit,
    handleReset,
    performSend,
    handleUsePreset,
    templates: templates.data,
    templatesLoading: templates.loading,
    editingTemplate,
    setEditingTemplate,
    templateForm,
    setTemplateForm,
    showTemplateModal,
    openTemplateModal,
    closeTemplateModal,
    handleUseTemplate,
    handleSaveTemplate,
    handleDeleteTemplate,
    scheduledNotifications: scheduled.items,
    scheduledForceSend,
    setScheduledForceSend,
    scheduledClassNow,
    editingScheduled,
    setEditingScheduled,
    scheduledForm,
    setScheduledForm,
    showScheduledModal,
    openScheduledModal,
    closeScheduledModal,
    handleUseCurrentFormForScheduled,
    handleTriggerScheduled,
    handleCancelScheduled,
    handleDeleteScheduled,
    handleSaveScheduled,
    showHistory,
    closeHistory,
    historyData,
    historyStats,
    historyPage,
    setHistoryPage,
    historyTotal,
    historyFilter,
    setHistoryFilter,
    isLoadingHistory,
    handleCleanHistory,
    historyColumns,
  };

  return {
    deps,
    draftAvailable,
    handleRestoreDraft,
    handleDiscardDraft,
    loadError,
    openHistory,
    mqttConnected,
    scheduled,
    scheduledPage,
    setScheduledPage,
    scheduledPerPage,
  };
}
