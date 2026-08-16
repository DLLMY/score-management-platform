import { useEffect, useState } from 'react';
import api from '../../services/api';

/**
 * 公共实体下拉组件（ClassSelect / StudentSelect / SubjectSelect）。
 *
 * 背景：字段统一化后多个页面（考勤/班委/值日/座位/学习小组/文化墙/活动/学法/
 * 作业/审批等）各自内联"加载列表 + Select"实现，产生大量重复代码且样式漂移。
 * 本组件统一数据加载（模块级缓存，低频列表只请求一次）、显示格式与交互，
 * 落实《全项目模块字段统一化审查报告》铁律 3：同一字段全页面显示/交互一致。
 */

export interface EntityOption {
  id: number;
  name: string;
  class_name?: string;
}

/** 基础样式：与各页既有 Select 一致的圆角/边框/焦点态；可用 className 覆盖。 */
const baseClass =
  'w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-slate-800 dark:text-slate-100 disabled:opacity-60';

// 模块级缓存：班级/学生/科目为低频列表，避免每个页面挂载都重复请求
const listCache = new Map<string, unknown>();

async function fetchCached<T>(key: string, fetcher: () => Promise<T>): Promise<T | null> {
  if (listCache.has(key)) return listCache.get(key) as T;
  try {
    const data = await fetcher();
    listCache.set(key, data);
    return data;
  } catch {
    return null;
  }
}

function useClassOptions(): EntityOption[] {
  const [options, setOptions] = useState<EntityOption[]>([]);
  useEffect(() => {
    fetchCached('classes', async () => {
      const res = await api.classes.getAll();
      return (res && res.classes) || [];
    }).then((list) => setOptions((list as EntityOption[]) || []));
  }, []);
  return options;
}

function useStudentOptions(): EntityOption[] {
  const [options, setOptions] = useState<EntityOption[]>([]);
  useEffect(() => {
    fetchCached('students', async () => {
      const res = await api.users.getAll({ per_page: 500, skipCache: true });
      return (res && (res.users || res)) || [];
    }).then((list) => setOptions((list as EntityOption[]) || []));
  }, []);
  return options;
}

function useSubjectOptions(): EntityOption[] {
  const [options, setOptions] = useState<EntityOption[]>([]);
  useEffect(() => {
    fetchCached('subjects', async () => {
      const res = await api.subjects.getAll();
      return Array.isArray(res) ? res : [];
    }).then((list) => setOptions((list as EntityOption[]) || []));
  }, []);
  return options;
}

interface EntitySelectProps {
  value: number | null | undefined;
  onChange: (id: number) => void;
  disabled?: boolean;
  /** 是否包含空选项（可选场景），空选项值为 0 */
  allowEmpty?: boolean;
  /** allowEmpty 时空选项文案，默认 "请选择" */
  emptyLabel?: string;
  /** 列表为空时展示的占位文案 */
  emptyPlaceholder?: string;
  className?: string;
}

function renderOptions(options: EntityOption[], props: EntitySelectProps, label: string) {
  const { allowEmpty, emptyLabel, emptyPlaceholder } = props;
  if (options.length === 0 && !allowEmpty) {
    return <option value={0}>{emptyPlaceholder || `暂无${label}`}</option>;
  }
  return (
    <>
      {allowEmpty && <option value={0}>{emptyLabel || `请选择${label}`}</option>}
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
          {o.class_name ? `（${o.class_name}）` : ''}
        </option>
      ))}
    </>
  );
}

function EntitySelect(
  props: EntitySelectProps & { options: EntityOption[]; label: string }
) {
  const { value, onChange, disabled, className, options, label } = props;

  // 非可选场景：options 就绪后若 value 为空，自动默认第一项（保持原"默认第一个班级"交互）
  useEffect(() => {
    if (!props.allowEmpty && options.length > 0 && !value) {
      onChange(options[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, value]);

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(Number(e.target.value))}
      disabled={disabled}
      className={className || baseClass}
    >
      {renderOptions(options, props, label)}
    </select>
  );
}

/** 班级下拉：数据源 api.classes.getAll() */
export function ClassSelect(props: EntitySelectProps) {
  const options = useClassOptions();
  return <EntitySelect {...props} options={options} label='班级' />;
}

/** 学生下拉：数据源 api.users.getAll({per_page:500})，显示 姓名（班级） */
export function StudentSelect(props: EntitySelectProps) {
  const options = useStudentOptions();
  return <EntitySelect {...props} options={options} label='学生' />;
}

/** 科目下拉：数据源 api.subjects.getAll()，通常 allowEmpty */
export function SubjectSelect(props: EntitySelectProps) {
  const options = useSubjectOptions();
  return <EntitySelect {...props} options={options} label='科目' />;
}

export default ClassSelect;
