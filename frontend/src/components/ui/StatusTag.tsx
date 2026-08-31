/**
 * 统一状态徽标组件（F2 公共组件提取 2026-08-22）
 *
 * 收敛散落页面的内联状态色 span（原 55 处 bg-green-100/bg-red-100/... 手写 className
 * 与文案三元，颜色/圆角/字号不统一）。统一色板：
 *   success=绿 / warning=黄 / danger=红 / info=蓝 / neutral=灰
 * 同时导出 STATUS_TAG_CLASS 供"映射对象"模式复用（如 ExamManagement 的 statusClass）。
 */

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const STATUS_TAG_CLASS: Record<StatusTone, string> = {
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  neutral: 'bg-gray-100 text-gray-600',
};

/** 常见业务状态 → tone 的语义映射（启用/正常/在线/已通过 → success 等） */
export const STATUS_TONE_MAP: Record<string, StatusTone> = {
  // 启用类
  enabled: 'success',
  active: 'success',
  published: 'info',
  // 停用/异常类
  disabled: 'neutral',
  inactive: 'neutral',
  closed: 'neutral',
  // 流程类
  pending: 'warning',
  processing: 'info',
  approved: 'success',
  rejected: 'danger',
  // 设备类
  online: 'success',
  offline: 'danger',
  error: 'danger',
  // 通用
  normal: 'success',
  abnormal: 'danger',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
};

interface StatusTagProps {
  /** 色板基调；不传时尝试从 toneKey 映射 */
  tone?: StatusTone;
  /** 文案（不传时按 tone 输出默认文案） */
  label?: string;
  /** 业务状态值（如 'published'/'pending'），用于 STATUS_TONE_MAP 自动推断 tone */
  toneKey?: string;
  className?: string;
}

const DEFAULT_LABEL: Record<StatusTone, string> = {
  success: '正常',
  warning: '待处理',
  danger: '异常',
  info: '进行中',
  neutral: '停用',
};

export function StatusTag({ tone, label, toneKey, className = '' }: StatusTagProps) {
  const resolvedTone: StatusTone = tone ?? (toneKey ? STATUS_TONE_MAP[toneKey] ?? 'neutral' : 'neutral');
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${STATUS_TAG_CLASS[resolvedTone]} ${className}`}
    >
      {label ?? DEFAULT_LABEL[resolvedTone]}
    </span>
  );
}

export default StatusTag;
