import { useCallback, useSyncExternalStore } from 'react';

/**
 * 班主任工作台「当前班级」共享状态。
 *
 * 背景：工作台的 12 个子页在 App.tsx 里是 <Routes> 下的兄弟节点，彼此没有共同父组件，
 * 因此无法用 React Context 跨页共享（除非改 App.tsx 包一层 Provider）。
 * 这里用「模块级 store + useSyncExternalStore」实现：
 * - 客户端路由跳转时模块不卸载 → 班级选择在子页之间保持一致；
 * - 额外写入 sessionStorage → 同一标签页刷新后仍保留（不跨标签页，避免互相干扰）。
 *
 * 约定：0 表示「全部班级」（视图不过滤）。
 * 注意：本 Hook 只承载「视图筛选」的班级；弹窗表单绑定的班级仍用页面本地
 * selectedClassId（ClassSelect 不传 allowEmpty，自动默认第一项），两者不可混用。
 */

const STORAGE_KEY = 'workbench.currentClassId';

/** 视图筛选的「全部班级」哨兵值 */
export const ALL_CLASSES = 0;

function readInitial(): number {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return ALL_CLASSES;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : ALL_CLASSES;
  } catch {
    // 隐私模式 / storage 被禁用时静默降级为内存态
    return ALL_CLASSES;
  }
}

let currentClassId: number = readInitial();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): number {
  return currentClassId;
}

/** 命令式读取（非组件环境，如事件回调里取最新值） */
export function getWorkbenchClassId(): number {
  return currentClassId;
}

/** 命令式写入，会通知所有订阅中的工作台页面 */
export function setWorkbenchClassId(classId: number): void {
  const next = Number.isFinite(classId) && classId > 0 ? Math.trunc(classId) : ALL_CLASSES;
  if (next === currentClassId) return;
  currentClassId = next;
  try {
    if (next === ALL_CLASSES) {
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      sessionStorage.setItem(STORAGE_KEY, String(next));
    }
  } catch {
    // 忽略存储失败，内存态仍然生效
  }
  listeners.forEach(listener => listener());
}

/**
 * 订阅工作台当前班级。
 *
 * @returns [classId, setClassId] —— classId 为 0 时代表「全部班级」
 *
 * @example
 * const [filterClassId, setFilterClassId] = useWorkbenchClass();
 * <ClassSelect allowEmpty emptyLabel='全部班级' value={filterClassId} onChange={setFilterClassId} />
 */
export function useWorkbenchClass(): [number, (classId: number) => void] {
  const classId = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setClassId = useCallback((next: number) => setWorkbenchClassId(next), []);
  return [classId, setClassId];
}

export default useWorkbenchClass;
