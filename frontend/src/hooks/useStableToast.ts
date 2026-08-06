import { useRef, useEffect, useCallback } from 'react';
import { useToast } from '../context/ToastContext';

/**
 * 稳定的 Toast Hook - 防止 useEffect 无限循环
 * 
 * 问题背景：
 * - useToast() 返回的 showToast 函数每次渲染都是新引用
 * - 如果在 useCallback 的依赖数组中包含 showToast，会导致回调函数每次都重新创建
 * - 如果 useEffect 依赖这个回调函数，就会形成无限循环
 * 
 * 解决方案：
 * - 使用 useRef 保存 showToast 的最新引用
 * - 返回一个稳定的 showToast 函数，不随渲染变化
 * - 该函数内部通过 ref 调用最新的 showToast
 * 
 * 使用方式：
 * ```typescript
 * // 推荐：使用 useStableToast
 * const { showToast } = useStableToast();
 * 
 * const fetchData = useCallback(async () => {
 *   try {
 *     // ...
 *   } catch (error) {
 *     showToast('error', '获取数据失败'); // 无需将 showToast 加入依赖
 *   }
 * }, []); // 依赖数组为空，不会触发无限循环
 * ```
 * 
 * 禁止：直接使用 useToast() 在 useCallback 依赖中
 * ```typescript
 * // ❌ 错误：会导致无限循环
 * const { showToast } = useToast();
 * const fetchData = useCallback(async () => {
 *   // ...
 *   showToast('error', '失败');
 * }, [showToast]); // showToast 每次变化 → fetchData 每次变化 → useEffect 无限循环
 * ```
 */
export function useStableToast() {
  const { showToast } = useToast();
  const showToastRef = useRef(showToast);

  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  const stableShowToast = useCallback(
    (
      type: 'success' | 'error' | 'warning' | 'info',
      message: string,
      options?: { undoAction?: () => void; undoLabel?: string; details?: string; errorFields?: string[] }
    ) => {
      showToastRef.current(type, message, options);
    },
    []
  );

  return { showToast: stableShowToast };
}