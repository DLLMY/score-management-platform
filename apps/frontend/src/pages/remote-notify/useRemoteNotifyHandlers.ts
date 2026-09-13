/* eslint-disable react-hooks/exhaustive-deps */
/**
 * 远程通知页逻辑 hook 的「处理器」子模块（拆法 C）。
 * T12-10c 拆分（2026-09-12）：原 useRemoteNotifyLogic 内的 16 个回调外提至此，
 * 通过 RemoteNotifySharedDeps 注入 state/setter/loader；函数体逐字原搬，零漂移。
 */
import { useCallback, type Dispatch, type SetStateAction } from 'react';
import logger from '../../utils/logger';
import api, {
  type RemoteNotifyPreview,
  type NotifyTemplate,
  type ScheduledNotify,
  type NotifyHistory,
} from '../../services/api';
import { useConfirm } from '../../components';
import { type UseListFetchResult, useStableToast } from '../../hooks';
import type {
  NotifyMode,
  NotifyForm,
  ScoreChangeForm,
  TemplateFormData,
  ScheduledFormData,
  PreviewConfirmState,
  RemoteNotifyDraft,
  SendResult,
  QuickPreset,
  NotifyPayload,
} from './types';

export interface RemoteNotifySharedDeps {
  showToast: ReturnType<typeof useStableToast>['showToast'];
  mode: NotifyMode;
  setMode: Dispatch<SetStateAction<NotifyMode>>;
  setIsSending: Dispatch<SetStateAction<boolean>>;
  setLastResult: Dispatch<SetStateAction<SendResult | null>>;
  setMqttConnected: Dispatch<SetStateAction<boolean | null>>;
  forceSend: boolean;
  scheduledForceSend: boolean;
  setPreviewConfirm: Dispatch<SetStateAction<PreviewConfirmState | null>>;
  confirmRef: { current: ReturnType<typeof useConfirm> };
  form: NotifyForm;
  setForm: Dispatch<SetStateAction<NotifyForm>>;
  scoreForm: ScoreChangeForm;
  setScoreForm: Dispatch<SetStateAction<ScoreChangeForm>>;
  templateForm: TemplateFormData;
  editingTemplate: NotifyTemplate | null;
  loadTemplates: () => Promise<void>;
  closeTemplateModal: () => void;
  loadScheduledNotifications: () => Promise<void>;
  scheduledForm: ScheduledFormData;
  setScheduledForm: Dispatch<SetStateAction<ScheduledFormData>>;
  openScheduledModal: () => void;
  closeScheduledModal: () => void;
  editingScheduled: ScheduledNotify | null;
  setEditingScheduled: Dispatch<SetStateAction<ScheduledNotify | null>>;
  clearDraft: () => void;
  restoreDraft: () => RemoteNotifyDraft | null;
  discardChanges: () => void;
  historyList: UseListFetchResult<NotifyHistory>;
  historyStatsFetch: { refetch: (opts?: { skipCache?: boolean }) => Promise<void> };
}

export interface RemoteNotifyHandlerSet {
  handleRestoreDraft: () => void;
  handleDiscardDraft: () => void;
  checkMqttStatus: () => Promise<void>;
  handleCleanHistory: () => Promise<void>;
  performSend: (
    notifyData: NotifyPayload,
    kind: 'broadcast' | 'device',
    deviceId?: string
  ) => Promise<void>;
  handleSubmit: () => Promise<void>;
  handleReset: () => void;
  handleUseTemplate: (template: NotifyTemplate) => void;
  handleUsePreset: (preset: QuickPreset) => void;
  handleSaveTemplate: () => Promise<void>;
  handleDeleteTemplate: (id: number) => Promise<void>;
  handleSaveScheduled: () => Promise<void>;
  handleDeleteScheduled: (id: number) => Promise<void>;
  handleCancelScheduled: (id: number) => Promise<void>;
  handleTriggerScheduled: (id: number) => Promise<void>;
  handleUseCurrentFormForScheduled: () => void;
}

export function useRemoteNotifyHandlers(deps: RemoteNotifySharedDeps): RemoteNotifyHandlerSet {
  const {
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
  } = deps;

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
      historyList.refetch();
      historyStatsFetch.refetch();
    } catch (error) {
      showToast('error', '清理失败');
    }
  }, [historyList, historyStatsFetch, showToast]);

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
    (preset: QuickPreset) => {
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

  return {
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
  };
}
