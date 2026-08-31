import React from 'react';

/**
 * 公共开关组件（ToggleSwitch）。
 *
 * 背景：字段统一化后 7 个页面（班级/科目/文化墙/活动/排行规则/学法/分类）
 * 各自内联相同样式的 Switch toggle，产生重复代码且配色漂移。
 * 本组件统一交互，开态配色默认 primary→indigo 渐变，可用 activeClass 覆盖
 * 以保留各页主题色。
 */

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** 开态配色类（默认 primary→indigo 渐变，各页可用 activeClass 保留主题色） */
  activeClass?: string;
  /** 关态配色类 */
  inactiveClass?: string;
  size?: 'md' | 'lg';
}

const SIZES = {
  md: { track: 'w-12 h-6', knobOn: 'left-6', knob: 'w-5 h-5' },
  lg: { track: 'w-14 h-7', knobOn: 'left-7', knob: 'w-6 h-6' },
};

export function ToggleSwitch({
  checked,
  onChange,
  disabled,
  activeClass = 'bg-gradient-to-r from-primary-500 to-indigo-500',
  inactiveClass = 'bg-slate-300 dark:bg-slate-600',
  size = 'lg',
}: ToggleSwitchProps) {
  const s = SIZES[size];
  return (
    <button
      type='button'
      role='switch'
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative ${s.track} rounded-full transition-all duration-300 ${
        checked ? activeClass : inactiveClass
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div
        className={`absolute top-0.5 ${
          s.knob
        } bg-white rounded-full shadow-lg transition-all duration-300 ${
          checked ? s.knobOn : 'left-0.5'
        }`}
      />
    </button>
  );
}

export default ToggleSwitch;
