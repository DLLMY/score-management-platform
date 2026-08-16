import logger from '../utils/logger';
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useCallback, useEffect } from 'react';
import { Send, Radio, Monitor, Bell, Volume2, VolumeX, AlertTriangle, TestTube, CheckCircle, Loader2, Wifi, WifiOff, Bookmark, Clock, History, Palette, Plus, Trash2, Edit2, Calendar, Play, Pause, Filter, ChevronLeft, ChevronRight, Trash } from 'lucide-react';
import api, { NotifyTemplate, ScheduledNotify, NotifyHistory } from '../services/api';
import { useForm, useModal, useConfirmDialog, useClassNowStatus } from '../hooks';
import type { BlockScope } from '../hooks';
import { useStableToast } from '../hooks/useStableToast';
import { PermissionButton, ClassStatusBadge } from '../components';

interface NotifyForm {
  text: string;
  volume: number;
  speak: boolean;
  popup: boolean;
  timeout_sec: number;
  urgent: boolean;
  device_id: string;
  bg_color: string;
  text_color: string;
  font_size: number;
  language: string;
  [key: string]: unknown;
}

type NotifyMode = 'broadcast' | 'device' | 'test' | 'score_change';

interface ScoreChangeForm {
  student_name: string;
  score_change: number;
  reason: string;
  course: string;
  device_id: string;
  [key: string]: unknown;
}

// 快捷预设模板
const QUICK_PRESETS = [
  { name: '上课提醒', text: '请同学们注意，上课时间到了，请回到座位准备上课。', urgent: false },
  { name: '下课通知', text: '下课时间到了，请同学们整理好桌面有序离开教室。', urgent: false },
  { name: '紧急会议', text: '紧急通知：请所有老师立即到会议室开会！', urgent: true },
  { name: '作业提醒', text: '请同学们注意，今日作业截止时间为下午5点，请按时提交。', urgent: false },
  { name: '考试通知', text: '考试即将开始，请同学们准备好文具，保持安静。', urgent: true },
  { name: '放学提醒', text: '放学时间到了，请同学们有序离校，注意安全。', urgent: false },
];

// 预设背景颜色
const PRESET_COLORS = [
  { name: '黑色', value: '#000000' },
  { name: '红色', value: '#FF0000' },
  { name: '蓝色', value: '#0000FF' },
  { name: '绿色', value: '#00FF00' },
  { name: '黄色', value: '#FFFF00' },
  { name: '紫色', value: '#800080' },
  { name: '橙色', value: '#FFA500' },
  { name: '灰色', value: '#808080' },
  { name: '深灰', value: '#333333' },
  { name: '深蓝', value: '#001133' },
  { name: '深红', value: '#8B0000' },
  { name: '金色', value: '#FFD700' },
];

// 预设文字颜色
const PRESET_TEXT_COLORS = [
  { name: '红色', value: '#FF0000' },
  { name: '白色', value: '#FFFFFF' },
  { name: '黄色', value: '#FFFF00' },
  { name: '蓝色', value: '#0000FF' },
  { name: '绿色', value: '#00FF00' },
  { name: '橙色', value: '#FFA500' },
  { name: '紫色', value: '#800080' },
  { name: '黑色', value: '#000000' },
  { name: '金色', value: '#FFD700' },
  { name: '青色', value: '#00FFFF' },
  { name: '粉红', value: '#FF69B4' },
  { name: '天蓝', value: '#87CEEB' },
];

function RemoteNotify() {
  const { showToast } = useStableToast();
  const [mode, setMode] = useState<NotifyMode>('broadcast');
  const [isSending, setIsSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string; topic: string } | null>(null);
  const [mqttConnected, setMqttConnected] = useState<boolean | null>(null);
  // 强制发送开关（受 notification.force_send 权限门控，仅超管可见复选框）
  const [forceSend, setForceSend] = useState(false);
  const [scheduledForceSend, setScheduledForceSend] = useState(false);
  
  // 使用 useConfirmDialog 管理确认对话框
  const { show: showConfirm } = useConfirmDialog();
  
  // 使用 useForm 管理表单状态
  const {
    formData: form,
    setFormData: setForm,
  } = useForm<NotifyForm>({
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
  }, {
    text: { required: true, minLength: 1 },
  });
  
  const {
    formData: scoreForm,
    setFormData: setScoreForm,
  } = useForm<ScoreChangeForm>({
    student_name: '',
    score_change: 0,
    reason: '',
    course: '',
    device_id: '',
  }, {
    student_name: { required: true, minLength: 1 },
  });
  
  // 模板相关状态
  const [templates, setTemplates] = useState<NotifyTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<NotifyTemplate | null>(null);
  // 数据加载失败标记（模板/定时/历史任一失败置位，页面显示警示条而非空态误导）
  const [loadError, setLoadError] = useState(false);

  // 班级实时上课状态（用于下发前的拦截提示；scope 必须对应后端判定口径）
  const nowDeviceId = mode === 'device' ? form.device_id : mode === 'score_change' ? scoreForm.device_id : undefined;
  const nowScope: BlockScope = mode === 'broadcast'
    ? 'broadcast'
    : (nowDeviceId ? 'class' : 'global');
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
  } = useForm<{
    name: string;
    text: string;
    category: string;
    bg_color: string;
    text_color: string;
    font_size: number;
    language: string;
    [key: string]: unknown;
  }>({
    name: '',
    text: '',
    category: '',
    bg_color: '#000000',
    text_color: '#FF0000',
    font_size: 48,
    language: 'zh',
  }, {
    name: { required: true, minLength: 1 },
    text: { required: true, minLength: 1 },
  });
  
  // 使用 useModal 管理弹窗状态
  const { isOpen: showTemplateModal, open: openTemplateModal, close: closeTemplateModal } = useModal<NotifyTemplate | null>({
    onClose: () => {
      resetTemplateForm();
      setEditingTemplate(null);
    },
  });
  
  // 历史记录
  const [historyData, setHistoryData] = useState<NotifyHistory[]>([]);
  const [historyStats, setHistoryStats] = useState<{ total_count: number; today_count: number; week_count: number; month_count: number; success_count: number; fail_count: number; success_rate: number } | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyFilter, setHistoryFilter] = useState<string>('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const { isOpen: showHistory, open: openHistory, close: closeHistory } = useModal<null>({});
  
  // 定时通知相关状态
  const [scheduledNotifications, setScheduledNotifications] = useState<ScheduledNotify[]>([]);
  const [editingScheduled, setEditingScheduled] = useState<ScheduledNotify | null>(null);
  
  const {
    formData: scheduledForm,
    setFormData: setScheduledForm,
    resetForm: resetScheduledForm,
  } = useForm<{
    text: string;
    volume: number;
    speak: boolean;
    popup: boolean;
    timeout_sec: number;
    urgent: boolean;
    send_mode: string;
    device_id: string;
    scheduled_at: string;
    repeat_type: string;
    repeat_interval: number;
    repeat_day_of_week: number[];
    repeat_end_at: string;
    [key: string]: unknown;
  }>({
    text: '',
    volume: 0.7,
    speak: true,
    popup: true,
    timeout_sec: 8,
    urgent: false,
    send_mode: 'broadcast',
    device_id: '',
    scheduled_at: '',
    repeat_type: 'once',
    repeat_interval: 1,
    repeat_day_of_week: [0, 1, 2, 3, 4],
    repeat_end_at: '',
  }, {
    text: { required: true, minLength: 1 },
    scheduled_at: { required: true, minLength: 1 },
  });
  
  const { isOpen: showScheduledModal, open: openScheduledModal, close: closeScheduledModal } = useModal<ScheduledNotify | null>({
    onClose: () => {
      resetScheduledForm();
      setEditingScheduled(null);
    },
  });

  const checkMqttStatus = useCallback(async () => {
    try {
      const status = await api.mqtt.getStatus();
      setMqttConnected(status.connected);
    } catch {
      setMqttConnected(false);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const data = await api.notifyTemplates.getAll();
      setTemplates(data);
      setLoadError(false);
    } catch (error) {
      logger.error('加载模板失败:', error);
      setLoadError(true);
    }
  }, []);

  const loadScheduledNotifications = useCallback(async () => {
    try {
      const data = await api.scheduledNotify.getAll();
      setScheduledNotifications(data);
      setLoadError(false);
    } catch (error) {
      logger.error('加载定时通知失败:', error);
      setLoadError(true);
    }
  }, []);

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
      setHistoryData(result.data);
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
    loadTemplates();
    loadScheduledNotifications();
    if (showHistory) {
      loadHistoryData();
      loadHistoryStats();
    }
  }, [checkMqttStatus, loadTemplates, loadScheduledNotifications, showHistory, loadHistoryData, loadHistoryStats]);

  useEffect(() => {
    if (showHistory) {
      loadHistoryData();
      loadHistoryStats();
    }
  }, [showHistory, historyPage, historyFilter, loadHistoryData, loadHistoryStats]);

  const handleCleanHistory = useCallback(async () => {
    if (!window.confirm(`确定要清理30天前的历史记录吗？`)) return;
    try {
      await api.notifyHistory.clean(30);
      showToast('success', '历史记录已清理');
      loadHistoryData();
      loadHistoryStats();
    } catch (error) {
      showToast('error', '清理失败');
    }
  }, [loadHistoryData, loadHistoryStats, showToast, showConfirm]);

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

    setIsSending(true);
    setLastResult(null);

    try {
      let result: unknown;

      if (mode === 'score_change') {
        const scoreData = {
          student_name: scoreForm.student_name.trim(),
          score_change: scoreForm.score_change,
          reason: scoreForm.reason.trim(),
          course: scoreForm.course.trim() || undefined,
          device_id: scoreForm.device_id.trim() || undefined,
          force_send: forceSend,
        };
        result = await api.remoteNotify.scoreChange(scoreData);
      } else {
        const notifyData = {
          text: form.text.trim(),
          volume: form.speak ? form.volume : undefined,
          speak: form.speak,
          popup: form.popup,
          timeout_sec: form.timeout_sec,
          urgent: form.urgent,
          force_send: forceSend,
        };

        switch (mode) {
          case 'broadcast':
            result = await api.remoteNotify.broadcast(notifyData);
            break;
          case 'device':
            result = await api.remoteNotify.sendToDevice(form.device_id.trim(), notifyData);
            break;
          case 'test':
            result = await api.remoteNotify.test({ force_send: forceSend });
            break;
        }
      }

      const data = result as { success: boolean; message: string; topic: string };
      setLastResult(data);

      if (data.success) {
        showToast('success', data.message);
        if (mode === 'score_change') {
          setScoreForm({
            student_name: '',
            score_change: 0,
            reason: '',
            course: '',
            device_id: '',
          });
        } else if (mode !== 'test') {
          setForm((prev) => ({ ...prev, text: '' }));
        }
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
  }, [form, mode, showToast, checkMqttStatus, scoreForm]);

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

  const handleUseTemplate = useCallback(async (template: NotifyTemplate) => {
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
  }, [form.device_id, showToast]);

  const handleUsePreset = useCallback((preset: typeof QUICK_PRESETS[0]) => {
    setForm(prev => ({
      ...prev,
      text: preset.text,
      urgent: preset.urgent,
    }));
    showToast('success', `已加载预设: ${preset.name}`);
  }, [showToast]);

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

  const handleDeleteTemplate = useCallback(async (id: number) => {
    try {
      await api.notifyTemplates.delete(id);
      showToast('success', '模板已删除');
      loadTemplates();
    } catch (error) {
      showToast('error', '删除失败');
    }
  }, [loadTemplates, showToast]);

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
      loadScheduledNotifications();
      closeScheduledModal();
    } catch (error) {
      showToast('error', '保存失败');
    }
  }, [scheduledForm, editingScheduled, loadScheduledNotifications, showToast]);

  const handleDeleteScheduled = useCallback(async (id: number) => {
    try {
      await api.scheduledNotify.delete(id);
      showToast('success', '定时通知已删除');
      loadScheduledNotifications();
    } catch (error) {
      showToast('error', '删除失败');
    }
  }, [loadScheduledNotifications, showToast]);

  const handleCancelScheduled = useCallback(async (id: number) => {
    try {
      await api.scheduledNotify.cancel(id);
      showToast('success', '定时通知已取消');
      loadScheduledNotifications();
    } catch (error) {
      showToast('error', '取消失败');
    }
  }, [loadScheduledNotifications, showToast]);

  const handleTriggerScheduled = useCallback(async (id: number) => {
    try {
      await api.scheduledNotify.trigger(id, { force_send: scheduledForceSend });
      showToast('success', '通知已发送');
      loadScheduledNotifications();
    } catch (error) {
      showToast('error', '发送失败');
    }
  }, [loadScheduledNotifications, showToast, scheduledForceSend]);

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

  return (
    <div className='max-w-6xl mx-auto'>
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
          <p className='text-gray-500 dark:text-slate-400 mt-1'>通过MQTT向远程电脑客户端发送通知消息</p>
        </div>
        <div className='flex items-center gap-3'>
          <button
            onClick={() => (showHistory ? closeHistory() : openHistory())}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${showHistory ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-600' : 'bg-gray-100/80 dark:bg-slate-700/50 text-gray-600 dark:text-slate-300'}`}
          >
            <History className='w-4 h-4' />
            历史记录
          </button>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${mqttConnected === true ? 'bg-green-100/80 dark:bg-green-500/20' : mqttConnected === false ? 'bg-red-100/80 dark:bg-red-500/20' : 'bg-gray-100/80 dark:bg-slate-700/50'}`}>
            {mqttConnected === true ? <Wifi className='w-4 h-4 text-green-600' /> : mqttConnected === false ? <WifiOff className='w-4 h-4 text-red-600' /> : <Loader2 className='w-4 h-4 text-gray-500 animate-spin' />}
            <span className={`text-sm font-medium ${mqttConnected === true ? 'text-green-700' : mqttConnected === false ? 'text-red-700' : 'text-gray-600'}`}>
              {mqttConnected === true ? 'MQTT已连接' : mqttConnected === false ? 'MQTT未连接' : '检查中...'}
            </span>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* 左侧：快捷预设和模板 */}
        <div className='lg:col-span-1 space-y-6'>
          {/* 快捷预设 */}
          <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-200/50 dark:border-slate-700/50 p-4'>
            <h3 className='text-lg font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2'>
              <Clock className='w-5 h-5 text-primary-500' />
              快捷预设
            </h3>
            <div className='space-y-2'>
              {QUICK_PRESETS.map((preset, index) => (
                <button
                  key={index}
                  onClick={() => handleUsePreset(preset)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                    preset.urgent
                      ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20'
                      : 'bg-gray-50 dark:bg-slate-700/50 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600/50'
                  }`}
                >
                  <span className='font-medium'>{preset.name}</span>
                  {preset.urgent && <span className='ml-2 text-xs bg-red-500 text-white px-1 rounded'>紧急</span>}
                </button>
              ))}
            </div>
          </div>

          {/* 我的模板 */}
          <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-200/50 dark:border-slate-700/50 p-4'>
            <div className='flex items-center justify-between mb-3'>
              <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
                <Bookmark className='w-5 h-5 text-primary-500' />
                我的模板
              </h3>
              <PermissionButton
                permission='notification.send'
                onClick={() => {
                  setEditingTemplate(null);
                  setTemplateForm({ name: '', text: form.text, category: '', bg_color: form.bg_color, text_color: form.text_color, font_size: form.font_size, language: form.language });
                  openTemplateModal();
                }}
                className='flex items-center gap-1 px-2 py-1 rounded-lg bg-primary-100 dark:bg-primary-500/20 text-primary-600 text-sm hover:bg-primary-200 dark:hover:bg-primary-500/30'
              >
                <Plus className='w-4 h-4' />
                新建
              </PermissionButton>
            </div>
            {templates.length === 0 ? (
              <p className='text-sm text-gray-500 dark:text-slate-400 text-center py-4'>暂无模板，点击新建按钮创建</p>
            ) : (
              <div className='space-y-2 max-h-60 overflow-y-auto'>
                {templates.map((template) => (
                  <div key={template.id} className='flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-slate-700/50 group'>
                    <button
                      onClick={() => handleUseTemplate(template)}
                      className='flex-1 text-left text-sm text-gray-700 dark:text-slate-300 hover:text-primary-600 truncate'
                    >
                      {template.name}
                      {template.category && <span className='ml-2 text-xs text-gray-500'>({template.category})</span>}
                    </button>
                    <div className='hidden group-hover:flex items-center gap-1'>
                      <PermissionButton
                        permission='notification.send'
                        onClick={() => {
                          setEditingTemplate(template);
                          setTemplateForm({
                            name: template.name,
                            text: template.text,
                            category: template.category || '',
                            bg_color: template.bg_color || '#000000',
                            text_color: template.text_color || '#FF0000',
                            font_size: template.font_size || 48,
                            language: template.language || 'zh',
                          });
                          openTemplateModal();
                        }}
                        className='p-1 rounded text-gray-500 hover:text-primary-600'
                      >
                        <Edit2 className='w-4 h-4' />
                      </PermissionButton>
                      <PermissionButton
                        permission='notification.send'
                        onClick={() => handleDeleteTemplate(template.id)}
                        className='p-1 rounded text-gray-500 hover:text-red-600'
                      >
                        <Trash2 className='w-4 h-4' />
                      </PermissionButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 定时通知 */}
          <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-200/50 dark:border-slate-700/50 p-4'>
            <div className='flex items-center justify-between mb-3'>
              <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
                <Calendar className='w-5 h-5 text-primary-500' />
                定时通知
              </h3>
              <PermissionButton
                permission='notification.send'
                onClick={handleUseCurrentFormForScheduled}
                className='flex items-center gap-1 px-2 py-1 rounded-lg bg-primary-100 dark:bg-primary-500/20 text-primary-600 text-sm hover:bg-primary-200 dark:hover:bg-primary-500/30'
              >
                <Plus className='w-4 h-4' />
                新建
              </PermissionButton>
            </div>
            <ClassStatusBadge
              state={scheduledClassNow}
              forceSend={scheduledForceSend}
              onForceSendChange={setScheduledForceSend}
              forceSendLabel='强制发送（跳过上课时间限制，作用于「立即发送」，将记入审计）'
            />
            {scheduledNotifications.length === 0 ? (
              <p className='text-sm text-gray-500 dark:text-slate-400 text-center py-4'>暂无定时通知</p>
            ) : (
              <div className='space-y-2 max-h-60 overflow-y-auto'>
                {scheduledNotifications.map((item) => (
                  <div key={item.id} className='flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-slate-700/50 group'>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2'>
                        <span className={`w-2 h-2 rounded-full ${
                          item.status === 'sent' ? 'bg-green-500'
                          : item.status === 'pending' ? 'bg-yellow-500'
                          : item.status === 'failed' ? 'bg-red-500'
                          : 'bg-gray-400'
                        }`}></span>
                        <span className='text-sm text-gray-700 dark:text-slate-300 truncate'>{item.text}</span>
                      </div>
                      <div className='flex items-center gap-2 mt-1'>
                        <Clock className='w-3 h-3 text-gray-400' />
                        <span className='text-xs text-gray-500'>{(item.next_send_at || item.scheduled_at) ? new Date(item.next_send_at || item.scheduled_at).toLocaleString('zh-CN') : '--'}</span>
                        {item.repeat_type !== 'once' && (
                          <span className='text-xs text-primary-500'>{item.repeat_type === 'daily' ? '每天' : item.repeat_type === 'weekly' ? '每周' : '每月'}</span>
                        )}
                      </div>
                    </div>
                    <div className='hidden group-hover:flex items-center gap-1'>
                      <PermissionButton
                        permission='notification.send'
                        onClick={() => handleTriggerScheduled(item.id)}
                        className='p-1 rounded text-gray-500 hover:text-green-600'
                        title='立即发送'
                      >
                        <Play className='w-4 h-4' />
                      </PermissionButton>
                      {item.status === 'pending' && (
                        <PermissionButton
                          permission='notification.send'
                          onClick={() => handleCancelScheduled(item.id)}
                          className='p-1 rounded text-gray-500 hover:text-yellow-600'
                          title='取消'
                        >
                          <Pause className='w-4 h-4' />
                        </PermissionButton>
                      )}
                      <PermissionButton
                        permission='notification.send'
                        onClick={() => handleDeleteScheduled(item.id)}
                        className='p-1 rounded text-gray-500 hover:text-red-600'
                        title='删除'
                      >
                        <Trash2 className='w-4 h-4' />
                      </PermissionButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右侧：发送表单 */}
        <div className='lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-200/50 dark:border-slate-700/50 p-6'>
          <div className='flex gap-4 mb-6'>
            <button
              onClick={() => setMode('broadcast')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${mode === 'broadcast' ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30' : 'bg-gray-100/80 dark:bg-slate-700/50 text-gray-600 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-600/50'}`}
            >
              <Radio className='w-5 h-5' />
              广播通知
            </button>
            <button
              onClick={() => setMode('device')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${mode === 'device' ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30' : 'bg-gray-100/80 dark:bg-slate-700/50 text-gray-600 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-600/50'}`}
            >
              <Monitor className='w-5 h-5' />
              指定设备
            </button>
            <button
              onClick={() => setMode('test')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${mode === 'test' ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30' : 'bg-gray-100/80 dark:bg-slate-700/50 text-gray-600 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-600/50'}`}
            >
              <TestTube className='w-5 h-5' />
              测试通知
            </button>
            <button
              onClick={() => setMode('score_change')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${mode === 'score_change' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'bg-gray-100/80 dark:bg-slate-700/50 text-gray-600 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-600/50'}`}
            >
              <Bookmark className='w-5 h-5' />
              积分变化
            </button>
          </div>

          <div className='space-y-5'>
            {mode === 'device' && (
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>设备ID</label>
                <input
                  type='text'
                  value={form.device_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, device_id: e.target.value }))}
                  placeholder='输入电脑客户端ID（启动时显示）'
                  className='w-full px-4 py-3 rounded-xl border border-gray-200/80 dark:border-slate-600/80 bg-white dark:bg-slate-700/50 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all'
                />
              </div>
            )}

            {mode !== 'test' && mode !== 'score_change' && (
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>通知内容</label>
                <textarea
                  value={form.text}
                  onChange={(e) => setForm((prev) => ({ ...prev, text: e.target.value }))}
                  placeholder='输入要发送的通知文本...'
                  rows={4}
                  className='w-full px-4 py-3 rounded-xl border border-gray-200/80 dark:border-slate-600/80 bg-white dark:bg-slate-700/50 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all resize-none'
                />
              </div>
            )}

            {mode === 'score_change' && (
              <div className='space-y-4'>
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>学生姓名 *</label>
                    <input
                      type='text'
                      value={scoreForm.student_name}
                      onChange={(e) => setScoreForm((prev) => ({ ...prev, student_name: e.target.value }))}
                      placeholder='输入学生姓名'
                      className='w-full px-4 py-3 rounded-xl border border-gray-200/80 dark:border-slate-600/80 bg-white dark:bg-slate-700/50 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all'
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>积分变化 *</label>
                    <div className='flex items-center gap-2'>
                      <button
                        onClick={() => setScoreForm((prev) => ({ ...prev, score_change: Math.max(-100, prev.score_change - 1) }))}
                        className='px-3 py-3 rounded-xl border border-gray-200/80 dark:border-slate-600/80 hover:bg-gray-100 dark:hover:bg-slate-600/50 transition-all'
                      >
                        -
                      </button>
                      <input
                        type='number'
                        value={scoreForm.score_change}
                        onChange={(e) => setScoreForm((prev) => ({ ...prev, score_change: parseInt(e.target.value) || 0 }))}
                        placeholder='0'
                        className='flex-1 px-4 py-3 rounded-xl border border-gray-200/80 dark:border-slate-600/80 bg-white dark:bg-slate-700/50 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all text-center'
                      />
                      <button
                        onClick={() => setScoreForm((prev) => ({ ...prev, score_change: Math.min(100, prev.score_change + 1) }))}
                        className='px-3 py-3 rounded-xl border border-gray-200/80 dark:border-slate-600/80 hover:bg-gray-100 dark:hover:bg-slate-600/50 transition-all'
                      >
                        +
                      </button>
                    </div>
                    <div className='flex gap-2 mt-2'>
                      <button
                        onClick={() => setScoreForm((prev) => ({ ...prev, score_change: 5 }))}
                        className='px-3 py-1 rounded-lg text-xs bg-green-100 dark:bg-green-500/20 text-green-600 hover:bg-green-200 dark:hover:bg-green-500/30 transition-all'
                      >
                        +5
                      </button>
                      <button
                        onClick={() => setScoreForm((prev) => ({ ...prev, score_change: 10 }))}
                        className='px-3 py-1 rounded-lg text-xs bg-green-100 dark:bg-green-500/20 text-green-600 hover:bg-green-200 dark:hover:bg-green-500/30 transition-all'
                      >
                        +10
                      </button>
                      <button
                        onClick={() => setScoreForm((prev) => ({ ...prev, score_change: -5 }))}
                        className='px-3 py-1 rounded-lg text-xs bg-red-100 dark:bg-red-500/20 text-red-600 hover:bg-red-200 dark:hover:bg-red-500/30 transition-all'
                      >
                        -5
                      </button>
                      <button
                        onClick={() => setScoreForm((prev) => ({ ...prev, score_change: -10 }))}
                        className='px-3 py-1 rounded-lg text-xs bg-red-100 dark:bg-red-500/20 text-red-600 hover:bg-red-200 dark:hover:bg-red-500/30 transition-all'
                      >
                        -10
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>变动原因 *</label>
                  <input
                    type='text'
                    value={scoreForm.reason}
                    onChange={(e) => setScoreForm((prev) => ({ ...prev, reason: e.target.value }))}
                    placeholder='输入积分变动原因（如：课堂表现优秀）'
                    className='w-full px-4 py-3 rounded-xl border border-gray-200/80 dark:border-slate-600/80 bg-white dark:bg-slate-700/50 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all'
                  />
                </div>
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>课程名称</label>
                    <input
                      type='text'
                      value={scoreForm.course}
                      onChange={(e) => setScoreForm((prev) => ({ ...prev, course: e.target.value }))}
                      placeholder='输入课程名称（可选）'
                      className='w-full px-4 py-3 rounded-xl border border-gray-200/80 dark:border-slate-600/80 bg-white dark:bg-slate-700/50 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all'
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>指定设备</label>
                    <input
                      type='text'
                      value={scoreForm.device_id}
                      onChange={(e) => setScoreForm((prev) => ({ ...prev, device_id: e.target.value }))}
                      placeholder='设备ID（不填则广播）'
                      className='w-full px-4 py-3 rounded-xl border border-gray-200/80 dark:border-slate-600/80 bg-white dark:bg-slate-700/50 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all'
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 样式设置 */}
            {mode !== 'test' && mode !== 'score_change' && (
              <div className='grid grid-cols-2 gap-4 p-4 rounded-xl bg-gray-50 dark:bg-slate-700/30'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 flex items-center gap-1'>
                    <Palette className='w-4 h-4' />
                    背景颜色
                  </label>
                  <div className='flex items-center gap-2 mb-2'>
                    <input
                      type='color'
                      value={form.bg_color}
                      onChange={(e) => setForm(prev => ({ ...prev, bg_color: e.target.value }))}
                      className='w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200 dark:border-slate-600'
                    />
                    <input
                      type='text'
                      value={form.bg_color}
                      onChange={(e) => setForm(prev => ({ ...prev, bg_color: e.target.value }))}
                      className='flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 text-sm font-mono'
                    />
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => setForm(prev => ({ ...prev, bg_color: color.value }))}
                        className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${form.bg_color === color.value ? 'border-primary-500 ring-2 ring-primary-500/30' : 'border-gray-200 dark:border-slate-600'}`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 flex items-center gap-1'>
                    <Palette className='w-4 h-4' />
                    文字颜色
                  </label>
                  <div className='flex items-center gap-2 mb-2'>
                    <input
                      type='color'
                      value={form.text_color}
                      onChange={(e) => setForm(prev => ({ ...prev, text_color: e.target.value }))}
                      className='w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200 dark:border-slate-600'
                    />
                    <input
                      type='text'
                      value={form.text_color}
                      onChange={(e) => setForm(prev => ({ ...prev, text_color: e.target.value }))}
                      className='flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 text-sm font-mono'
                    />
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    {PRESET_TEXT_COLORS.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => setForm(prev => ({ ...prev, text_color: color.value }))}
                        className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${form.text_color === color.value ? 'border-primary-500 ring-2 ring-primary-500/30' : 'border-gray-200 dark:border-slate-600'}`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {mode !== 'score_change' && (
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                    <div className='flex items-center gap-2'>
                      {form.speak ? <Volume2 className='w-4 h-4 text-primary-500' /> : <VolumeX className='w-4 h-4 text-gray-400' />}
                      语音播报
                    </div>
                  </label>
                  <div className='flex items-center gap-3'>
                    <label className='relative inline-flex items-center cursor-pointer'>
                      <input
                        type='checkbox'
                        checked={form.speak}
                        onChange={(e) => setForm((prev) => ({ ...prev, speak: e.target.checked }))}
                        className='sr-only peer'
                      />
                      <div className='w-11 h-6 bg-gray-200 dark:bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[""] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500' />
                    </label>
                    {form.speak && (
                      <div className='flex-1'>
                        <div className='flex items-center justify-between text-sm text-gray-500 dark:text-slate-400 mb-1'>
                          <span>音量</span>
                          <span>{Math.round(form.volume * 100)}%</span>
                        </div>
                        <input
                          type='range'
                          min='0'
                          max='1'
                          step='0.1'
                          value={form.volume}
                          onChange={(e) => setForm((prev) => ({ ...prev, volume: parseFloat(e.target.value) }))}
                          className='w-full h-2 bg-gray-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-primary-500'
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                    <div className='flex items-center gap-2'>
                      <Bell className='w-4 h-4 text-primary-500' />
                      弹窗显示
                    </div>
                  </label>
                  <div className='flex items-center gap-3'>
                    <label className='relative inline-flex items-center cursor-pointer'>
                      <input
                        type='checkbox'
                        checked={form.popup}
                        onChange={(e) => setForm((prev) => ({ ...prev, popup: e.target.checked }))}
                        className='sr-only peer'
                      />
                      <div className='w-11 h-6 bg-gray-200 dark:bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[""] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500' />
                    </label>
                    {form.popup && (
                      <div className='flex-1'>
                        <div className='flex items-center justify-between text-sm text-gray-500 dark:text-slate-400 mb-1'>
                          <span>自动关闭</span>
                          <span>{form.timeout_sec}秒</span>
                        </div>
                        <input
                          type='range'
                          min='3'
                          max='30'
                          step='1'
                          value={form.timeout_sec}
                          onChange={(e) => setForm((prev) => ({ ...prev, timeout_sec: parseInt(e.target.value) }))}
                          className='w-full h-2 bg-gray-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-primary-500'
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {mode !== 'score_change' && (
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                  <div className='flex items-center gap-2'>
                    <AlertTriangle className='w-4 h-4 text-red-500' />
                    紧急通知
                  </div>
                </label>
                <div className='flex items-center gap-3'>
                  <label className='relative inline-flex items-center cursor-pointer'>
                    <input
                      type='checkbox'
                      checked={form.urgent}
                      onChange={(e) => setForm((prev) => ({ ...prev, urgent: e.target.checked }))}
                      className='sr-only peer'
                    />
                    <div className='w-11 h-6 bg-gray-200 dark:bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[""] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500' />
                  </label>
                  <span className='text-sm text-gray-500 dark:text-slate-400'>
                    {form.urgent ? '红色全屏弹窗，高优先级' : '普通通知样式'}
                  </span>
                </div>
              </div>
            )}

            {/* 预览效果 */}
            {mode !== 'test' && mode !== 'score_change' && form.popup && (
              <div 
                className='p-4 rounded-xl border-2 border-gray-200 dark:border-slate-600 text-center'
                style={{ backgroundColor: form.bg_color, color: form.text_color, fontSize: `${Math.min(form.font_size, 24)}px` }}
              >
                {form.text || '预览效果'}
              </div>
            )}

            {lastResult && (
              <div className={`p-4 rounded-xl border ${lastResult.success ? 'bg-green-50/80 dark:bg-green-500/10 border-green-200/80 dark:border-green-500/30' : 'bg-red-50/80 dark:bg-red-500/10 border-red-200/80 dark:border-red-500/30'}`}>
                <div className='flex items-center gap-3'>
                  {lastResult.success ? <CheckCircle className='w-5 h-5 text-green-600' /> : <AlertTriangle className='w-5 h-5 text-red-600' />}
                  <div>
                    <p className={`font-medium ${lastResult.success ? 'text-green-700' : 'text-red-700'}`}>
                      {lastResult.success ? '发送成功' : '发送失败'}
                    </p>
                    <p className='text-sm text-gray-600 dark:text-slate-400 mt-1'>
                      {lastResult.message}
                    </p>
                    {lastResult.topic && (
                      <p className='text-xs text-gray-500 dark:text-slate-500 mt-1'>
                        主题: {lastResult.topic}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <ClassStatusBadge
              state={classNow}
              forceSend={forceSend}
              onForceSendChange={setForceSend}
            />

            <div className='flex gap-3 pt-2'>
              <PermissionButton
                permission='notification.send'
                onClick={handleSubmit}
                disabled={isSending}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${isSending ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary-500 text-white hover:bg-primary-600 shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40'}`}
              >
                {isSending ? <Loader2 className='w-5 h-5 animate-spin' /> : <Send className='w-5 h-5' />}
                {isSending ? '发送中...' : '发送通知'}
              </PermissionButton>
              <button
                onClick={handleReset}
                className='px-6 py-3 rounded-xl font-medium bg-gray-100/80 dark:bg-slate-700/50 text-gray-600 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-600/50 transition-all duration-200'
              >
                重置
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 模板编辑弹窗 */}
      {showTemplateModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-md'>
            <h3 className='text-lg font-semibold text-gray-800 dark:text-white mb-4'>
              {editingTemplate ? '编辑模板' : '新建模板'}
            </h3>
            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'>模板名称</label>
                <input
                  type='text'
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder='例如：上课提醒'
                  className='w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'>通知内容</label>
                <textarea
                  value={templateForm.text}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, text: e.target.value }))}
                  placeholder='输入通知文本...'
                  rows={3}
                  className='w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 resize-none'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'>分类</label>
                <input
                  type='text'
                  list='notify-template-categories'
                  value={templateForm.category}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, category: e.target.value }))}
                  placeholder='选择或输入分类'
                  className='w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600'
                />
                <datalist id='notify-template-categories'>
                  <option value='教学' />
                  <option value='行政' />
                  <option value='紧急' />
                  <option value='活动' />
                  <option value='其他' />
                </datalist>
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'>背景颜色</label>
                  <input
                    type='color'
                    value={templateForm.bg_color}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, bg_color: e.target.value }))}
                    className='w-full h-10 rounded cursor-pointer'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'>文字颜色</label>
                  <input
                    type='color'
                    value={templateForm.text_color}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, text_color: e.target.value }))}
                    className='w-full h-10 rounded cursor-pointer'
                  />
                </div>
              </div>
            </div>
            <div className='flex gap-3 mt-6'>
              <button
                onClick={handleSaveTemplate}
                className='flex-1 px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600'
              >
                保存
              </button>
              <button
                onClick={closeTemplateModal}
                className='px-4 py-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 定时通知编辑弹窗 */}
      {showScheduledModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-lg'>
            <h3 className='text-lg font-semibold text-gray-800 dark:text-white mb-4'>
              {editingScheduled ? '编辑定时通知' : '新建定时通知'}
            </h3>
            <div className='space-y-4 max-h-[70vh] overflow-y-auto'>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'>通知内容</label>
                <textarea
                  value={scheduledForm.text}
                  onChange={(e) => setScheduledForm(prev => ({ ...prev, text: e.target.value }))}
                  placeholder='输入通知文本...'
                  rows={3}
                  className='w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 resize-none'
                />
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'>发送时间</label>
                  <input
                    type='datetime-local'
                    value={scheduledForm.scheduled_at}
                    onChange={(e) => setScheduledForm(prev => ({ ...prev, scheduled_at: e.target.value }))}
                    className='w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'>重复类型</label>
                  <select
                    value={scheduledForm.repeat_type}
                    onChange={(e) => setScheduledForm(prev => ({ ...prev, repeat_type: e.target.value }))}
                    className='w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600'
                  >
                    <option value='once'>一次性</option>
                    <option value='daily'>每天</option>
                    <option value='weekly'>每周</option>
                    <option value='monthly'>每月</option>
                  </select>
                </div>
              </div>
              {scheduledForm.repeat_type !== 'once' && (
                <>
                  <div className='grid grid-cols-2 gap-4'>
                    <div>
                      <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'>重复间隔</label>
                      <input
                        type='number'
                        min='1'
                        value={scheduledForm.repeat_interval}
                        onChange={(e) => setScheduledForm(prev => ({ ...prev, repeat_interval: parseInt(e.target.value) || 1 }))}
                        className='w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600'
                      />
                    </div>
                    <div>
                      <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'>结束时间（可选）</label>
                      <input
                        type='datetime-local'
                        value={scheduledForm.repeat_end_at}
                        onChange={(e) => setScheduledForm(prev => ({ ...prev, repeat_end_at: e.target.value }))}
                        className='w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600'
                      />
                    </div>
                  </div>
                  {scheduledForm.repeat_type === 'weekly' && (
                    <div className='mt-4'>
                      <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>选择星期</label>
                      <div className='flex flex-wrap gap-2'>
                        {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((day, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              const dayNum = index;
                              setScheduledForm(prev => ({
                                ...prev,
                                repeat_day_of_week: prev.repeat_day_of_week.includes(dayNum)
                                  ? prev.repeat_day_of_week.filter(d => d !== dayNum)
                                  : [...prev.repeat_day_of_week, dayNum].sort()
                              }));
                            }}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              scheduledForm.repeat_day_of_week.includes(index)
                                ? 'bg-primary-500 text-white'
                                : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'>发送模式</label>
                <select
                  value={scheduledForm.send_mode}
                  onChange={(e) => setScheduledForm(prev => ({ ...prev, send_mode: e.target.value }))}
                  className='w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600'
                >
                  <option value='broadcast'>广播通知</option>
                  <option value='device'>指定设备</option>
                </select>
              </div>
              {scheduledForm.send_mode === 'device' && (
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'>设备ID</label>
                  <input
                    type='text'
                    value={scheduledForm.device_id}
                    onChange={(e) => setScheduledForm(prev => ({ ...prev, device_id: e.target.value }))}
                    placeholder='输入设备ID'
                    className='w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600'
                  />
                </div>
              )}
              <div className='flex items-center gap-4'>
                <label className='flex items-center gap-2'>
                  <input
                    type='checkbox'
                    checked={scheduledForm.speak}
                    onChange={(e) => setScheduledForm(prev => ({ ...prev, speak: e.target.checked }))}
                    className='rounded border-gray-300 text-primary-600 focus:ring-primary-500'
                  />
                  <span className='text-sm text-gray-700 dark:text-slate-300'>语音播报</span>
                </label>
                <label className='flex items-center gap-2'>
                  <input
                    type='checkbox'
                    checked={scheduledForm.popup}
                    onChange={(e) => setScheduledForm(prev => ({ ...prev, popup: e.target.checked }))}
                    className='rounded border-gray-300 text-primary-600 focus:ring-primary-500'
                  />
                  <span className='text-sm text-gray-700 dark:text-slate-300'>弹窗显示</span>
                </label>
                <label className='flex items-center gap-2'>
                  <input
                    type='checkbox'
                    checked={scheduledForm.urgent}
                    onChange={(e) => setScheduledForm(prev => ({ ...prev, urgent: e.target.checked }))}
                    className='rounded border-gray-300 text-red-600 focus:ring-red-500'
                  />
                  <span className='text-sm text-gray-700 dark:text-slate-300'>紧急通知</span>
                </label>
              </div>
            </div>
            <div className='flex gap-3 mt-6'>
              <button
                onClick={handleSaveScheduled}
                className='flex-1 px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600'
              >
                保存
              </button>
              <button
                onClick={closeScheduledModal}
                className='px-4 py-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 通知历史记录弹窗 */}
      {showHistory && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden'>
            <div className='flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700'>
              <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
                <History className='w-5 h-5 text-primary-500' />
                通知历史记录
              </h3>
              <button
                onClick={closeHistory}
                className='p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700'
              >
                <span className='text-gray-500 text-xl'>×</span>
              </button>
            </div>

            {/* 统计卡片 */}
            {historyStats && (
              <div className='grid grid-cols-4 gap-4 p-6 bg-gray-50 dark:bg-slate-700/30'>
                <div className='bg-white dark:bg-slate-800 rounded-xl p-4'>
                  <p className='text-sm text-gray-500 dark:text-slate-400'>总发送量</p>
                  <p className='text-2xl font-bold text-gray-800 dark:text-white mt-1'>{historyStats.total_count}</p>
                </div>
                <div className='bg-white dark:bg-slate-800 rounded-xl p-4'>
                  <p className='text-sm text-gray-500 dark:text-slate-400'>今日发送</p>
                  <p className='text-2xl font-bold text-blue-600 mt-1'>{historyStats.today_count}</p>
                </div>
                <div className='bg-white dark:bg-slate-800 rounded-xl p-4'>
                  <p className='text-sm text-gray-500 dark:text-slate-400'>成功率</p>
                  <p className='text-2xl font-bold text-green-600 mt-1'>{historyStats.success_rate}%</p>
                </div>
                <div className='bg-white dark:bg-slate-800 rounded-xl p-4'>
                  <p className='text-sm text-gray-500 dark:text-slate-400'>失败次数</p>
                  <p className='text-2xl font-bold text-red-600 mt-1'>{historyStats.fail_count}</p>
                </div>
              </div>
            )}

            {/* 筛选和操作栏 */}
            <div className='flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700'>
              <div className='flex items-center gap-3'>
                <Filter className='w-4 h-4 text-gray-500' />
                <select
                  value={historyFilter}
                  onChange={(e) => {
                    setHistoryFilter(e.target.value);
                    setHistoryPage(1);
                  }}
                  className='px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700'
                >
                  <option value=''>全部状态</option>
                  <option value='sent'>发送成功</option>
                  <option value='failed'>发送失败</option>
                </select>
              </div>
              <button
                onClick={handleCleanHistory}
                className='flex items-center gap-2 px-3 py-2 rounded-lg bg-red-100 dark:bg-red-500/20 text-red-600 hover:bg-red-200 dark:hover:bg-red-500/30'
              >
                <Trash className='w-4 h-4' />
                清理30天前记录
              </button>
            </div>

            {/* 历史记录列表 */}
            <div className='overflow-y-auto max-h-[400px]'>
              {isLoadingHistory ? (
                <div className='flex items-center justify-center py-8'>
                  <Loader2 className='w-6 h-6 animate-spin text-primary-500' />
                </div>
              ) : historyData.length === 0 ? (
                <p className='text-center py-8 text-gray-500 dark:text-slate-400'>暂无历史记录</p>
              ) : (
                <table className='w-full'>
                  <thead className='bg-gray-50 dark:bg-slate-700/50 sticky top-0'>
                    <tr>
                      <th className='text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-slate-400'>内容</th>
                      <th className='text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-slate-400'>发送模式</th>
                      <th className='text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-slate-400'>状态</th>
                      <th className='text-left px-4 py-3 text-sm font-medium text-gray-600 dark:text-slate-400'>时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((item) => (
                      <tr key={item.id} className='border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50'>
                        <td className='px-4 py-3'>
                          <div className='flex items-center gap-2'>
                            {item.urgent && <AlertTriangle className='w-4 h-4 text-red-500' />}
                            <span className='text-sm text-gray-800 dark:text-white truncate max-w-xs'>{item.text}</span>
                          </div>
                        </td>
                        <td className='px-4 py-3'>
                          <span className={`px-2 py-1 rounded text-xs ${item.send_mode === 'broadcast' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600' : 'bg-green-100 dark:bg-green-500/20 text-green-600'}`}>
                            {item.send_mode === 'broadcast' ? '广播' : '指定设备'}
                          </span>
                        </td>
                        <td className='px-4 py-3'>
                          <span className={`px-2 py-1 rounded text-xs ${
                            item.status === 'sent'
                              ? 'bg-green-100 dark:bg-green-500/20 text-green-600'
                              : item.status === 'pending'
                              ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600'
                              : item.status === 'failed'
                              ? 'bg-red-100 dark:bg-red-500/20 text-red-600'
                              : 'bg-gray-100 dark:bg-gray-500/20 text-gray-500'
                          }`}>
                            {item.status === 'sent' ? '成功' : item.status === 'pending' ? '待发送' : item.status === 'failed' ? '失败' : '未知'}
                          </span>
                        </td>
                        <td className='px-4 py-3'>
                          <span className='text-sm text-gray-500 dark:text-slate-400'>
                            {item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 分页 */}
            {historyTotal > 20 && (
              <div className='flex items-center justify-between p-4 border-t border-gray-200 dark:border-slate-700'>
                <p className='text-sm text-gray-500 dark:text-slate-400'>
                  显示 {(historyPage - 1) * 20 + 1} - {Math.min(historyPage * 20, historyTotal)} 条，共 {historyTotal} 条
                </p>
                <div className='flex items-center gap-2'>
                  <button
                    onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
                    disabled={historyPage === 1}
                    className='p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    <ChevronLeft className='w-4 h-4' />
                  </button>
                  <span className='text-sm text-gray-600 dark:text-slate-300'>{historyPage}</span>
                  <button
                    onClick={() => setHistoryPage((prev) => Math.min(Math.ceil(historyTotal / 20), prev + 1))}
                    disabled={historyPage >= Math.ceil(historyTotal / 20)}
                    className='p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    <ChevronRight className='w-4 h-4' />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 使用说明 */}
      <div className='mt-6 bg-blue-50/60 dark:bg-blue-500/10 rounded-xl border border-blue-200/50 dark:border-blue-500/20 p-5'>
        <h3 className='text-lg font-semibold text-blue-800 dark:text-blue-300 mb-3'>使用说明</h3>
        <ul className='space-y-2 text-sm text-blue-700 dark:text-blue-400'>
          <li className='flex items-start gap-2'>
            <span className='text-blue-500'>•</span>
            <span><strong>快捷预设</strong>：点击左侧预设按钮快速加载常用通知内容</span>
          </li>
          <li className='flex items-start gap-2'>
            <span className='text-blue-500'>•</span>
            <span><strong>我的模板</strong>：保存常用通知为模板，支持自定义样式和分类</span>
          </li>
          <li className='flex items-start gap-2'>
            <span className='text-blue-500'>•</span>
            <span><strong>样式设置</strong>：自定义弹窗背景色、文字颜色和播报语言</span>
          </li>
          <li className='flex items-start gap-2'>
            <span className='text-blue-500'>•</span>
            <span><strong>客户端安装</strong>：在 <code className='px-2 py-1 bg-white dark:bg-slate-700 rounded text-blue-800'>remote_notify</code> 目录运行 <code className='px-2 py-1 bg-white dark:bg-slate-700 rounded text-blue-800'>install.bat</code></span>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default RemoteNotify;