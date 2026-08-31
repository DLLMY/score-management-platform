// RemoteNotify 拆分子模块共享契约：接口 / 常量 / RemoteNotifyDeps 透传对象
// 拆分模式与 NLPManagement 一致：主壳 RemoteNotify.tsx 保留全部 state/loader/useMemo，
// 组装强类型 deps 透传给各子模块；子模块仅负责渲染并调用 deps 中的回调，行为逐字节等价。
import type { Dispatch, SetStateAction } from 'react';
import type { NotifyTemplate, ScheduledNotify, NotifyHistory, RemoteNotifyPreview } from '../../services/api';
import type { ColumnType } from '../../components/data-display/DataTable';
import { useClassNowStatus } from '../../hooks';

// ---------- 接口（原 RemoteNotify.tsx 内联定义迁移） ----------

export interface NotifyForm {
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

export type NotifyMode = 'broadcast' | 'device' | 'test' | 'score_change';

// M6: 立即发送的实际载荷（device/broadcast 共用）
export interface NotifyPayload {
  text: string;
  volume?: number;
  speak: boolean;
  popup: boolean;
  timeout_sec: number;
  urgent: boolean;
  force_send: boolean;
}

// M6: 发送前预览确认弹窗状态（防误发）
export interface PreviewConfirmState {
  open: boolean;
  kind: 'broadcast' | 'device';
  deviceId?: string;
  notifyData: NotifyPayload;
  /** preview 获取失败时为 null（弹窗仍展示，但不含名单） */
  preview: RemoteNotifyPreview | null;
  expanded: boolean;
}

export interface ScoreChangeForm {
  student_name: string;
  score_change: number;
  reason: string;
  course: string;
  device_id: string;
  [key: string]: unknown;
}

export interface ScheduledFormData {
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
}

// 模板编辑表单局部状态形状
export interface TemplateFormData {
  name: string;
  text: string;
  category: string;
  bg_color: string;
  text_color: string;
  font_size: number;
  language: string;
  [key: string]: unknown;
}

// M3: 远程通知草稿——发送表单/积分表单/定时表单（均可序列化）
export interface RemoteNotifyDraft {
  mode: NotifyMode;
  form: NotifyForm;
  scoreForm: ScoreChangeForm;
  scheduledForm: ScheduledFormData;
  activeScheduledModal: boolean;
}

export interface SendResult {
  success: boolean;
  message: string;
  topic: string;
}

export interface HistoryStats {
  total_count: number;
  today_count: number;
  week_count: number;
  month_count: number;
  success_count: number;
  fail_count: number;
  success_rate: number;
}

// ---------- 常量（原 RemoteNotify.tsx 默认值/预设迁移） ----------

export const DEFAULT_NOTIFY_FORM: NotifyForm = {
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
};

export const DEFAULT_SCORE_FORM: ScoreChangeForm = {
  student_name: '',
  score_change: 0,
  reason: '',
  course: '',
  device_id: '',
};

export const DEFAULT_SCHEDULED_FORM: ScheduledFormData = {
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
};

export const DEFAULT_TEMPLATE_FORM: TemplateFormData = {
  name: '',
  text: '',
  category: '',
  bg_color: '#000000',
  text_color: '#FF0000',
  font_size: 48,
  language: 'zh',
};

// 快捷预设模板
export interface QuickPreset {
  name: string;
  text: string;
  urgent: boolean;
}
export const QUICK_PRESETS: QuickPreset[] = [
  { name: '上课提醒', text: '请同学们注意，上课时间到了，请回到座位准备上课。', urgent: false },
  { name: '下课通知', text: '下课时间到了，请同学们整理好桌面有序离开教室。', urgent: false },
  { name: '紧急会议', text: '紧急通知：请所有老师立即到会议室开会！', urgent: true },
  {
    name: '作业提醒',
    text: '请同学们注意，今日作业截止时间为下午5点，请按时提交。',
    urgent: false,
  },
  { name: '考试通知', text: '考试即将开始，请同学们准备好文具，保持安静。', urgent: true },
  { name: '放学提醒', text: '放学时间到了，请同学们有序离校，注意安全。', urgent: false },
];

// 预设背景颜色
export interface PresetColor {
  name: string;
  value: string;
}
export const PRESET_COLORS: PresetColor[] = [
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
export const PRESET_TEXT_COLORS: PresetColor[] = [
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

// 班级实时上课状态（useClassNowStatus 返回值类型）
export type ClassNowStatus = ReturnType<typeof useClassNowStatus>;

// ---------- RemoteNotifyDeps 透传契约 ----------
// 主壳把全部 state/setter/loader/column 分组装配为 deps；子模块 { deps } 解构使用，
// 由 tsc 校验所有缺失引用（最低回归风险）。
export interface RemoteNotifyDeps {
  // 发送表单（右侧）
  mode: NotifyMode;
  setMode: Dispatch<SetStateAction<NotifyMode>>;
  isSending: boolean;
  lastResult: SendResult | null;
  form: NotifyForm;
  setForm: Dispatch<SetStateAction<NotifyForm>>;
  scoreForm: ScoreChangeForm;
  setScoreForm: Dispatch<SetStateAction<ScoreChangeForm>>;
  forceSend: boolean;
  setForceSend: Dispatch<SetStateAction<boolean>>;
  previewConfirm: PreviewConfirmState | null;
  setPreviewConfirm: Dispatch<SetStateAction<PreviewConfirmState | null>>;
  classNow: ClassNowStatus;
  handleSubmit: () => Promise<void>;
  handleReset: () => void;
  performSend: (
    notifyData: NotifyPayload,
    kind: 'broadcast' | 'device',
    deviceId?: string
  ) => Promise<void>;

  // 快捷预设（左侧）
  handleUsePreset: (preset: QuickPreset) => void;

  // 我的模板（左侧）
  templates: NotifyTemplate[];
  templatesLoading: boolean;
  editingTemplate: NotifyTemplate | null;
  setEditingTemplate: Dispatch<SetStateAction<NotifyTemplate | null>>;
  templateForm: TemplateFormData;
  setTemplateForm: Dispatch<SetStateAction<TemplateFormData>>;
  showTemplateModal: boolean;
  openTemplateModal: () => void;
  closeTemplateModal: () => void;
  handleUseTemplate: (template: NotifyTemplate) => void;
  handleSaveTemplate: () => Promise<void>;
  handleDeleteTemplate: (id: number) => Promise<void>;

  // 定时通知（左侧）
  scheduledNotifications: ScheduledNotify[];
  scheduledForceSend: boolean;
  setScheduledForceSend: Dispatch<SetStateAction<boolean>>;
  scheduledClassNow: ClassNowStatus;
  editingScheduled: ScheduledNotify | null;
  setEditingScheduled: Dispatch<SetStateAction<ScheduledNotify | null>>;
  scheduledForm: ScheduledFormData;
  setScheduledForm: Dispatch<SetStateAction<ScheduledFormData>>;
  showScheduledModal: boolean;
  openScheduledModal: () => void;
  closeScheduledModal: () => void;
  handleUseCurrentFormForScheduled: () => void;
  handleTriggerScheduled: (id: number) => Promise<void>;
  handleCancelScheduled: (id: number) => Promise<void>;
  handleDeleteScheduled: (id: number) => Promise<void>;
  handleSaveScheduled: () => Promise<void>;

  // 通知历史记录弹窗
  showHistory: boolean;
  closeHistory: () => void;
  historyData: NotifyHistory[];
  historyStats: HistoryStats | null;
  historyPage: number;
  setHistoryPage: Dispatch<SetStateAction<number>>;
  historyTotal: number;
  historyFilter: string;
  setHistoryFilter: Dispatch<SetStateAction<string>>;
  isLoadingHistory: boolean;
  handleCleanHistory: () => Promise<void>;
  historyColumns: ColumnType<NotifyHistory>[];
}
