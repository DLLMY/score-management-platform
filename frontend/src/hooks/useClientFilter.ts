import { useMemo, useRef } from 'react';

/**
 * 本地列表过滤派生 hook（批次3 2026-08-23）。
 *
 * 收敛 15+ 处散落的 `filteredXxx = list.filter(predicate)` 内联派生
 * （ActivityManage / AttendanceManage / CultureBoard / ExamManagement 等）。
 * - predicate 用 ref 持有（内联箭头函数无需 useCallback，引用稳定）
 * - 仅 items 与显式 deps（searchTerm / filterStatus 等）变化时重算（useMemo）
 * - 返回派生数组；不改变数据源，纯派生零副作用
 *
 * 依赖方向（单向）：pages → useClientFilter
 */
export function useClientFilter<T>(
  items: T[],
  predicate: (item: T) => boolean,
  deps: unknown[] = []
): T[] {
  const predicateRef = useRef(predicate);
  predicateRef.current = predicate;

  return useMemo(
    () => items.filter((item) => predicateRef.current(item)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, ...deps]
  );
}

export default useClientFilter;
