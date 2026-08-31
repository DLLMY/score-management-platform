import type { LucideIcon } from 'lucide-react';

/**
 * 状态徽标（F8 2026-08-23）。
 *
 * 收敛 Diagnostics.HealthStatus / OpsCenter.HealthStatusBadge / SecurityAudit.SeverityBadge
 * 三处逐行重复的「status -> {color, icon, label} 映射 + fallback + 胶囊渲染」。
 * 页面侧保留各自局部组件签名，仅内部实现改为调用本组件（调用点零改动）。
 *
 * ⚠️ Tailwind JIT：color 类以字面量出现在 statusMap 中即可被扫描生成。
 */
export interface StatusBadgeEntry {
  color: string;
  icon: LucideIcon;
  label: string;
}

interface StatusBadgeProps {
  status: string;
  /** 状态映射表（如 healthy/degraded/unhealthy/warning/critical/unknown） */
  statusMap: Record<string, StatusBadgeEntry>;
  /** 未命中时的回退 key（如 'unknown' / 'info'） */
  fallbackKey: string;
  /** 容器标签：div（圆角胶囊）/ span（行内小徽标） */
  as?: 'div' | 'span';
  /** 尺寸：md（Diagnostics 风格）/ sm（OpsCenter 风格）/ xs（SecurityAudit 风格） */
  size?: 'md' | 'sm' | 'xs';
  /** 附加说明文字（md/sm 渲染，xs 不渲染） */
  message?: string;
}

const SIZE_CLASS = {
  md: {
    container: 'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium',
    icon: 16,
    messageClass: 'text-xs opacity-75',
  },
  sm: {
    container: 'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
    icon: 13,
    messageClass: 'opacity-75 max-w-[220px] truncate',
  },
  xs: {
    container: 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
    icon: 12,
    messageClass: '',
  },
} as const;

function StatusBadge({
  status,
  statusMap,
  fallbackKey,
  as = 'div',
  size = 'md',
  message,
}: StatusBadgeProps) {
  const cfg = statusMap[status] || statusMap[fallbackKey];
  const s = SIZE_CLASS[size];
  const Icon = cfg.icon;
  const Tag = as;

  return (
    <Tag className={`${s.container} ${cfg.color}`}>
      <Icon size={s.icon} />
      <span>{cfg.label}</span>
      {message && size !== 'xs' && (
        <span className={s.messageClass} title={message}>
          {size === 'sm' ? message : `| ${message}`}
        </span>
      )}
    </Tag>
  );
}

export default StatusBadge;
