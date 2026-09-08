import React from 'react';

/**
 * 统计卡片（F7 2026-08-23）。
 *
 * 收敛 ClassManagement / AttendanceManage / ActivityManage / MentalHealth 等处
 * 重复的「装饰渐变圆 + 渐变图标盒 + label + 大数字」统计卡结构。
 * size 控制 lg（ClassManagement 风格）/ sm（AttendanceManage 风格）两档尺寸。
 *
 * ⚠️ Tailwind JIT：gradient / glow 类必须以**字面量**传参（调用处写完整类名），
 * 否则不会被扫描生成。
 */
interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  /** 图标盒渐变，如 'from-blue-500 to-indigo-500' */
  iconGradient: string;
  /** 右上装饰圆渐变，如 'from-blue-500/10 to-indigo-500/10' */
  decoGradient: string;
  /** 图标盒阴影（仅 lg 生效），如 'shadow-blue-500/20' */
  glowClass?: string;
  size?: 'lg' | 'sm';
  /** 附加到最外层容器的类（如栅格跨列 col-span-2 md:col-span-1） */
  className?: string;
}

const SIZE_CLASS = {
  lg: {
    deco: 'w-24 h-24 -mr-8 -mt-8',
    iconBox: 'w-14 h-14 rounded-2xl',
    icon: 'w-7 h-7 text-white',
    gap: 'gap-4',
    label: 'text-sm font-medium text-slate-500 dark:text-slate-400',
    value: 'text-3xl font-bold text-slate-800 dark:text-slate-100',
    shadow: 'shadow-lg',
  },
  sm: {
    deco: 'w-20 h-20 -mr-6 -mt-6',
    iconBox: 'w-12 h-12 rounded-2xl',
    icon: 'w-6 h-6 text-white',
    gap: 'gap-3',
    label: 'text-xs font-medium text-slate-500 dark:text-slate-400',
    value: 'text-2xl font-bold text-slate-800 dark:text-slate-100',
    shadow: '',
  },
} as const;

function StatCard({
  label,
  value,
  icon,
  iconGradient,
  decoGradient,
  glowClass,
  size = 'lg',
  className = '',
}: StatCardProps) {
  const s = SIZE_CLASS[size];
  return (
    <div
      className={`relative overflow-hidden bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50 group hover:shadow-md transition-all duration-300 ${className}`}
    >
      <div
        className={`absolute top-0 right-0 bg-gradient-to-br ${decoGradient} rounded-full group-hover:scale-150 transition-transform duration-500 ${s.deco}`}
      />
      <div className={`relative flex items-center ${s.gap}`}>
        <div
          className={`bg-gradient-to-br ${iconGradient} flex items-center justify-center ${s.iconBox} ${s.shadow} ${glowClass || ''}`}
        >
          {icon}
        </div>
        <div>
          <p className={s.label}>{label}</p>
          <p className={s.value}>{value}</p>
        </div>
      </div>
    </div>
  );
}

export default StatCard;
