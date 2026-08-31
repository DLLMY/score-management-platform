import React from 'react';

/**
 * 起止日期范围选择（F10 2026-08-23）。
 *
 * 收敛 ActivityManage / AttendanceManage / CommitteeList / StudyGuide 等处重复的
 * 「grid-cols-2 双 date input + label + 错误态 + 红字提示」表单块。
 * 主题差异通过 focusColor / alwaysClass / okClass 参数化，渲染结果与原实现逐字符等价。
 */
interface DateRangeFieldProps {
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  startError?: string | null;
  endError?: string | null;
  /** focus ring 颜色，如 'focus:ring-violet-500/50' */
  focusColor: string;
  /** 恒生效的附加类（如 'transition-all'） */
  alwaysClass?: string;
  /** 仅正常态生效的附加类（如 'focus:border-blue-500'） */
  okClass?: string;
  startLabel?: string;
  endLabel?: string;
}

function DateRangeField({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  startError,
  endError,
  focusColor,
  alwaysClass = '',
  okClass = '',
  startLabel = '开始日期',
  endLabel = '结束日期',
}: DateRangeFieldProps) {
  const inputBase = `w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl focus:outline-none focus:ring-2 ${focusColor} text-slate-800 dark:text-slate-100 ${alwaysClass}`;

  const inputClass = (error?: string | null) =>
    `${inputBase} ${error ? 'border-red-500' : `border-slate-200 dark:border-slate-600 ${okClass}`}`;

  return (
    <div className='grid grid-cols-2 gap-4'>
      <div>
        <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
          {startLabel}
        </label>
        <input
          type='date'
          value={startValue}
          onChange={(e) => onStartChange(e.target.value)}
          className={inputClass(startError)}
        />
        {startError && <p className='mt-1 text-xs text-red-500'>{startError}</p>}
      </div>
      <div>
        <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
          {endLabel}
        </label>
        <input
          type='date'
          value={endValue}
          onChange={(e) => onEndChange(e.target.value)}
          className={inputClass(endError)}
        />
        {endError && <p className='mt-1 text-xs text-red-500'>{endError}</p>}
      </div>
    </div>
  );
}

export default DateRangeField;
