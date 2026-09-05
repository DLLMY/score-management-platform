import logger from '../utils/logger';
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { AlertTriangle, History, Wifi, WifiOff, Loader2 } from 'lucide-react';
import api, {
  NotifyTemplate,
  ScheduledNotify,
  NotifyHistory,
  RemoteNotifyPreview,
} from '../services/api';
import { useForm, useModal, useClassNowStatus } from '../hooks';
import { useAutoSave } from '../hooks/useAutoSave';
import type { BlockScope } from '../hooks';
import { useStableToast } from '../hooks/useStableToast';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { formatDateTime } from '../utils/format';
import { Pagination } from '../components/ui/Pagination';
import { useListData, useListFetch } from '../hooks';
import type { ColumnType } from '../components/data-display/DataTable';
import { PresetsPanel } from './remote-notify/PresetsPanel';
import { TemplatesPanel } from './remote-notify/TemplatesPanel';
import { ScheduledPanel } from './remote-notify/ScheduledPanel';
import { SendForm } from './remote-notify/SendForm';
import { HistoryPanel } from './remote-notify/HistoryPanel';
import {
  DEFAULT_NOTIFY_FORM,
  DEFAULT_SCORE_FORM,
  DEFAULT_SCHEDULED_FORM,
  DEFAULT_TEMPLATE_FORM,
  type NotifyForm,
  type NotifyMode,
  type NotifyPayload,
  type PreviewConfirmState,
  type ScoreChangeForm,
  type ScheduledFormData,
  type TemplateFormData,
  type RemoteNotifyDraft,
  type SendResult,
  type HistoryStats,
  type RemoteNotifyDeps,
} from './remote-notify/types';

// M3: 草稿是否有实质内容（内容/接收对象均空时静默清理）
function isDraftMeaningful(d: RemoteNotifyDraft): boolean {
  return (
    d.form.text.trim() !== '' ||
    d.form.device_id.trim() !== '' ||
    d.scoreForm.student_name.trim() !== '' ||
    d.scheduledForm.text.trim() !== '' ||
    d.scheduledForm.scheduled_at !== ''
  );
}

function RemoteNotify() {
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
  const [historyData, setHistoryData] = useState<NotifyHistory[]>([]);
  const [historyStats, setHistoryStats] = useState<HistoryStats | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyFilter, setHistoryFilter] = useState<string>('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

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

  const handleRestoreDraft = useCallback((): void => {
    const draft = restoreDraft();
    if (!draft) return;
    setMode(draft.mode);
    setForm({ ...draft.form });
    setScoreForm({ ...draft.scoreForm });
    setScheduledForm({ ...draft.scheduledForm });
    if (draft.activeScheduledModal) {
      setEditingScheduled(null);
      openScheduledModal();
    }
  }, [restoreDraft, setForm, setScoreForm, setScheduledForm, openScheduledModal]);

  const handleDiscardDraft = useCallback((): void => {
    discardChanges();
  }, [discardChanges]);

  const checkMqttStatus = useCallback(async () => {
    try {
      const status = await api.mqtt.getStatus();
      setMqttConnected(status.connected);
    } catch {
      setMqttConnected(false);
    }
  }, []);

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
        const list = Array.isArray(data) ? (data as ScheduledNotify[]) : (data?.items ?? []);
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

  const loadHistoryData = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const params: { page: number; per_page: number; status?: string } = {
        page: historyPage,
        per_page: 20,
      };
      if (historyFilter) {
        params.status = historyFilter;
      }
      const result = await api.notifyHistory.getAll(params);
      // M7: 数组赋值防护
      setHistoryData(Array.isArray(result.data) ? result.data : []);
      setHistoryTotal(result.total);
      setLoadError(false);
    } catch (error) {
      logger.error('加载历史记录失败:', error);
      setLoadError(true);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [historyPage, historyFilter]);

  const loadHistoryStats = useCallback(async () => {
    try {
      const stats = await api.notifyHistory.getStats();
      setHistoryStats(stats);
      setLoadError(false);
    } catch (error) {
      logger.error('加载统计数据失败:', error);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    checkMqttStatus();
    if (showHistory) {
      loadHistoryData();
      loadHistoryStats();
    }
  }, [checkMqttStatus, showHistory, loadHistoryData, loadHistoryStats]);

  useEffect(() => {
    if (showHistory) {
      loadHistoryData();
      loadHistoryStats();
    }
  }, [showHistory, historyPage, historyFilter, loadHistoryData, loadHistoryStats]);

  const handleCleanHistory = useCallback(async () => {
    const ok = await confirmRef.current({
      title: '清理历史记录',
      message: '确定要清理30天前的历史记录吗？',
      confirmText: '清理',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await api.notifyHistory.clean(30);
      showToast('success', '历史记录已清理');
      loadHistoryData();
      loadHistoryStats();
    } catch (error) {
      showToast('error', '清理失败');
    }
  }, [loadHistoryData, loadHistoryStats, showToast]);

  // M6: 实际发送（broadcast/device 专用）。预览确认弹窗确认后调用；失败弹 [重试]/[关闭]，重试复用同一 notifyData 直接重发（不再弹预览）
  const performSend = useCallback(
    async (notifyData: NotifyPayload, kind: 'broadcast' | 'device', deviceId?: string) => {
      setIsSending(true);
      setLastResult(null);

      const retry = (reason: string) => {
        void confirmRef
          .current({
            title: '发送失败',
            message: `发送失败：${reason}`,
            confirmText: '重试',
            cancelText: '关闭',
            type: 'warning',
          })
          .then((ok) => {
            if (ok) {
              void performSend(notifyData, kind, deviceId);
            }
          });
      };

      try {
        let result: unknown;
        if (kind === 'broadcast') {
          result = await api.remoteNotify.broadcast(notifyData);
        } else {
          result = await api.remoteNotify.sendToDevice(deviceId || '', notifyData);
        }

        const data = result as { success: boolean; message: string; topic: string };
        setLastResult(data);

        if (data.success) {
          showToast('success', data.message);
          clearDraft();
          setForm((prev) => ({ ...prev, text: '' }));
        } else {
          showToast('error', data.message);
          retry(data.message);
        }
      } catch (error) {
        const errMsg = (error as Error).message || '发送失败';
        showToast('error', errMsg);
        setLastResult({ success: false, message: errMsg, topic: '' });
        retry(errMsg);
      } finally {
        setIsSending(false);
        checkMqttStatus();
      }
    },
    [clearDraft, showToast, checkMqttStatus]
  );

  const handleSubmit = useCallback(async () => {
    if (mode === 'score_change') {
      if (!scoreForm.student_name.trim()) {
        showToast('warning', '请输入学生姓名');
        return;
      }
      if (scoreForm.score_change === 0) {
        showToast('warning', '请输入非零的积分变化值');
        return;
      }
      if (!scoreForm.reason.trim()) {
        showToast('warning', '请输入变动原因');
        return;
      }
    } else if (mode !== 'test' && !form.text.trim()) {
      showToast('warning', '请输入通知内容');
      return;
    }

    if (mode === 'device' && !form.device_id.trim()) {
      showToast('warning', '请输入设备ID');
      return;
    }

    if (mode === 'score_change') {
      const scoreData = {
        student_name: scoreForm.student_name.trim(),
        score_change: scoreForm.score_change,
        reason: scoreForm.reason.trim(),
        course: scoreForm.course.trim() || undefined,
        device_id: scoreForm.device_id.trim() || undefined,
        force_send: forceSend,
      };
      setIsSending(true);
      setLastResult(null);
      try {
        const result = await api.remoteNotify.scoreChange(scoreData);
        const data = result as { success: boolean; message: string; topic: string };
        setLastResult(data);

        if (data.success) {
          showToast('success', data.message);
          clearDraft();
          setScoreForm({
            student_name: '',
            score_change: 0,
            reason: '',
            course: '',
            device_id: '',
          });
        } else {
          showToast('error', data.message);
        }
      } catch (error) {
        const errMsg = (error as Error).message || '发送失败';
        showToast('error', errMsg);
        setLastResult({ success: false, message: errMsg, topic: '' });
      } finally {
        setIsSending(false);
        checkMqttStatus();
      }
      return;
    }

    const notifyData: NotifyPayload = {
      text: form.text.trim(),
      volume: form.speak ? form.volume : undefined,
      speak: form.speak,
      popup: form.popup,
      timeout_sec: form.timeout_sec,
      urgent: form.urgent,
      force_send: forceSend,
    };

    // M6: device/broadcast 发送前先获取在线预览（防误发）；失败静默降级，确认弹窗仍展示但不含名单
    if (mode === 'broadcast' || mode === 'device') {
      let preview: RemoteNotifyPreview | null = null;
      try {
        preview = await api.remoteNotify.preview();
      } catch (error) {
        logger.warn('发送前在线预览获取失败，将展示不含名单的确认弹窗:', error);
      }
      setPreviewConfirm({
        open: true,
        kind: mode,
        deviceId: mode === 'device' ? form.device_id.trim() : undefined,
        notifyData,
        preview,
        expanded: false,
      });
      return;
    }

    // mode === 'test'
    setIsSending(true);
    setLastResult(null);
    try {
      const result = await api.remoteNotify.test({ force_send: forceSend });
      const data = result as { success: boolean; message: string; topic: string };
      setLastResult(data);

      if (data.success) {
        showToast('success', data.message);
        clearDraft();
      } else {
        showToast('error', data.message);
      }
    } catch (error) {
      const errMsg = (error as Error).message || '发送失败';
      showToast('error', errMsg);
      setLastResult({ success: false, message: errMsg, topic: '' });
    } finally {
      setIsSending(false);
      checkMqttStatus();
    }
  }, [form, mode, showToast, checkMqttStatus, scoreForm, clearDraft, forceSend]);

  const handleReset = useCallback(() => {
    setForm({
      text: '',
      volume: 0.7,
      speak: true,
      popup: true,
      timeout_sec: 8,
      urgent: false,
      device_id: '',
      bg_color: '#000000',
      text_color: '#FF0000',
      font_size: 48,
      language: 'zh',
    });
    setLastResult(null);
  }, []);

  const handleUseTemplate = useCallback(
    async (template: NotifyTemplate) => {
      setForm({
        text: template.text,
        volume: template.volume || 0.7,
        speak: template.speak || true,
        popup: template.popup || true,
        timeout_sec: template.timeout_sec || 8,
        urgent: template.urgent || false,
        device_id: form.device_id,
        bg_color: template.bg_color || '#000000',
        text_color: template.text_color || '#FF0000',
        font_size: template.font_size || 48,
        language: template.language || 'zh',
      });
      showToast('success', `已加载模板: ${template.name}`);
    },
    [form.device_id, showToast]
  );

  const handleUsePreset = useCallback(
    (preset: { name: string; text: string; urgent: boolean }) => {
      setForm((prev) => ({
        ...prev,
        text: preset.text,
        urgent: preset.urgent,
      }));
      showToast('success', `已加载预设: ${preset.name}`);
    },
    [showToast]
  );

  const handleSaveTemplate = useCallback(async () => {
    if (!templateForm.name.trim() || !templateForm.text.trim()) {
      showToast('warning', '请填写模板名称和内容');
      return;
    }

    try {
      if (editingTemplate) {
        await api.notifyTemplates.update(editingTemplate.id, templateForm);
        showToast('success', '模板已更新');
      } else {
        await api.notifyTemplates.create(templateForm);
        showToast('success', '模板已保存');
      }
      loadTemplates();
      closeTemplateModal();
    } catch (error) {
      showToast('error', '保存失败');
    }
  }, [templateForm, editingTemplate, loadTemplates, showToast]);

  const handleDeleteTemplate = useCallback(
    async (id: number) => {
      const ok = await confirmRef.current({
        title: '删除确认',
        message: '确定要删除该通知模板吗？',
        confirmText: '删除',
        type: 'danger',
      });
      if (!ok) return; // 删除确认
      try {
        await api.notifyTemplates.delete(id);
        showToast('success', '模板已删除');
        loadTemplates();
      } catch (error) {
        showToast('error', '删除失败');
      }
    },
    [loadTemplates, showToast]
  );

  const handleSaveScheduled = useCallback(async () => {
    if (!scheduledForm.text.trim()) {
      showToast('warning', '请输入通知内容');
      return;
    }
    if (!scheduledForm.scheduled_at) {
      showToast('warning', '请选择发送时间');
      return;
    }

    try {
      if (editingScheduled) {
        await api.scheduledNotify.update(editingScheduled.id, scheduledForm);
        showToast('success', '定时通知已更新');
      } else {
        await api.scheduledNotify.create(scheduledForm);
        showToast('success', '定时通知已创建');
      }
      clearDraft();
      loadScheduledNotifications();
      closeScheduledModal();
    } catch (error) {
      showToast('error', '保存失败');
    }
  }, [scheduledForm, editingScheduled, loadScheduledNotifications, showToast, clearDraft]);

  const handleDeleteScheduled = useCallback(
    async (id: number) => {
      try {
        await api.scheduledNotify.delete(id);
        showToast('success', '定时通知已删除');
        loadScheduledNotifications();
      } catch (error) {
        showToast('error', '删除失败');
      }
    },
    [loadScheduledNotifications, showToast]
  );

  const handleCancelScheduled = useCallback(
    async (id: number) => {
      try {
        await api.scheduledNotify.cancel(id);
        showToast('success', '定时通知已取消');
        loadScheduledNotifications();
      } catch (error) {
        showToast('error', '取消失败');
      }
    },
    [loadScheduledNotifications, showToast]
  );

  const handleTriggerScheduled = useCallback(
    async (id: number) => {
      try {
        await api.scheduledNotify.trigger(id, { force_send: scheduledForceSend });
        showToast('success', '通知已发送');
        loadScheduledNotifications();
      } catch (error) {
        showToast('error', '发送失败');
      }
    },
    [loadScheduledNotifications, showToast, scheduledForceSend]
  );

  const handleUseCurrentFormForScheduled = useCallback(() => {
    setScheduledForm({
      text: form.text,
      volume: form.volume,
      speak: form.speak,
      popup: form.popup,
      timeout_sec: form.timeout_sec,
      urgent: form.urgent,
      send_mode: mode === 'device' ? 'device' : 'broadcast',
      device_id: form.device_id,
      scheduled_at: '',
      repeat_type: 'once',
      repeat_interval: 1,
      repeat_day_of_week: [0, 1, 2, 3, 4],
      repeat_end_at: '',
    });
    openScheduledModal();
  }, [form, mode, openScheduledModal]);

  const historyColumns = useMemo<ColumnType<NotifyHistory>[]>(
    () => [
      {
        title: '内容',
        key: 'text',
        dataIndex: 'text',
        render: (_, item) => (
          <div className='flex items-center gap-2'>
            {item.urgent && <AlertTriangle className='w-4 h-4 text-red-500' />}
            <span className='text-sm text-gray-800 dark:text-white truncate max-w-xs'>
              {item.text}
            </span>
          </div>
        ),
      },
      {
        title: '发送模式',
        key: 'send_mode',
        dataIndex: 'send_mode',
        render: (value) => (
          <span
            className={`px-2 py-1 rounded text-xs ${
              value === 'broadcast'
                ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600'
                : 'bg-green-100 dark:bg-green-500/20 text-green-600'
            }`}
          >
            {value === 'broadcast' ? '广播' : '指定设备'}
          </span>
        ),
      },
      {
        title: '状态',
        key: 'status',
        dataIndex: 'status',
        render: (value) => (
          <span
            className={`px-2 py-1 rounded text-xs ${
              value === 'sent'
                ? 'bg-green-100 dark:bg-green-500/20 text-green-600'
                : value === 'pending'
                ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600'
                : value === 'failed'
                ? 'bg-red-100 dark:bg-red-500/20 text-red-600'
                : 'bg-gray-100 dark:bg-gray-500/20 text-gray-500'
            }`}
          >
            {value === 'sent'
              ? '成功'
              : value === 'pending'
              ? '待发送'
              : value === 'failed'
              ? '失败'
              : '未知'}
          </span>
        ),
      },
      {
        title: '时间',
        key: 'created_at',
        dataIndex: 'created_at',
        render: (value) => (
          <span className='text-sm text-gray-500 dark:text-slate-400'>
            {formatDateTime(value as string, '-')}
          </span>
        ),
      },
    ],
    []
  );

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

  return (
    <div className='max-w-6xl mx-auto'>
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

      {loadError && (
        <div className='mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30'>
          <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0' />
          <p className='text-sm text-amber-700 dark:text-amber-300'>
            部分数据加载失败（模板/定时通知/历史记录），当前列表可能不完整，请刷新重试
          </p>
        </div>
      )}
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-gray-800 dark:text-white'>远程通知</h1>
          <p className='text-gray-500 dark:text-slate-400 mt-1'>
            通过MQTT向远程电脑客户端发送通知消息
          </p>
        </div>
        <div className='flex items-center gap-3'>
          <button
            onClick={() => (showHistory ? closeHistory() : openHistory())}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
              showHistory
                ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-600'
                : 'bg-gray-100/80 dark:bg-slate-700/50 text-gray-600 dark:text-slate-300'
            }`}
          >
            <History className='w-4 h-4' />
            历史记录
          </button>
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              mqttConnected === true
                ? 'bg-green-100/80 dark:bg-green-500/20'
                : mqttConnected === false
                ? 'bg-red-100/80 dark:bg-red-500/20'
                : 'bg-gray-100/80 dark:bg-slate-700/50'
            }`}
          >
            {mqttConnected === true ? (
              <Wifi className='w-4 h-4 text-green-600' />
            ) : mqttConnected === false ? (
              <WifiOff className='w-4 h-4 text-red-600' />
            ) : (
              <Loader2 className='w-4 h-4 text-gray-500 animate-spin' />
            )}
            <span
              className={`text-sm font-medium ${
                mqttConnected === true
                  ? 'text-green-700'
                  : mqttConnected === false
                  ? 'text-red-700'
                  : 'text-gray-600'
              }`}
            >
              {mqttConnected === true
                ? 'MQTT已连接'
                : mqttConnected === false
                ? 'MQTT未连接'
                : '检查中...'}
            </span>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* 左侧：快捷预设和模板 */}
        <div className='lg:col-span-1 space-y-6'>
          <PresetsPanel deps={deps} />
          <TemplatesPanel deps={deps} />
          <ScheduledPanel deps={deps} />
          {scheduled.total > 0 && (
            <Pagination
              currentPage={scheduledPage}
              totalPages={Math.max(1, Math.ceil(scheduled.total / scheduledPerPage))}
              onPageChange={setScheduledPage}
              totalItems={scheduled.total}
              itemsPerPage={scheduledPerPage}
            />
          )}
        </div>

        {/* 右侧：发送表单 */}
        <SendForm deps={deps} />
      </div>

      {/* 通知历史记录弹窗 */}
      <HistoryPanel deps={deps} />

      {/* 使用说明 */}
      <div className='mt-6 bg-blue-50/60 dark:bg-blue-500/10 rounded-xl border border-blue-200/50 dark:border-blue-500/20 p-5'>
        <h3 className='text-lg font-semibold text-blue-800 dark:text-blue-300 mb-3'>使用说明</h3>
        <ul className='space-y-2 text-sm text-blue-700 dark:text-blue-400'>
          <li className='flex items-start gap-2'>
            <span className='text-blue-500'>•</span>
            <span>
              <strong>快捷预设</strong>：点击左侧预设按钮快速加载常用通知内容
            </span>
          </li>
          <li className='flex items-start gap-2'>
            <span className='text-blue-500'>•</span>
            <span>
              <strong>我的模板</strong>：保存常用通知为模板，支持自定义样式和分类
            </span>
          </li>
          <li className='flex items-start gap-2'>
            <span className='text-blue-500'>•</span>
            <span>
              <strong>样式设置</strong>：自定义弹窗背景色、文字颜色和播报语言
            </span>
          </li>
          <li className='flex items-start gap-2'>
            <span className='text-blue-500'>•</span>
            <span>
              <strong>客户端安装</strong>：在{' '}
              <code className='px-2 py-1 bg-white dark:bg-slate-700 rounded text-blue-800'>
                remote_notify
              </code>{' '}
              目录运行{' '}
              <code className='px-2 py-1 bg-white dark:bg-slate-700 rounded text-blue-800'>
                install.bat
              </code>
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default RemoteNotify;
