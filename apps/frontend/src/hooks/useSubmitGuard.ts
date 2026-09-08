import { useCallback, useRef, useState } from 'react';

/**
 * S9 修复: 通用提交防重 hook（消除双击/连点导致的重复创建/重复提交）。
 *
 * 用法：
 *   const { submitting, run } = useSubmitGuard();
 *   <button disabled={submitting} onClick={() => run(handleSave)}>保存</button>
 *   run 内部保证同一时间仅一次执行；fn 抛错时自动解锁。
 */
export function useSubmitGuard() {
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  const run = useCallback(async (fn: () => Promise<unknown> | unknown) => {
    if (inFlight.current) {
      return; // 已有请求在途 → 直接忽略（防双击）
    }
    inFlight.current = true;
    setSubmitting(true);
    try {
      await fn();
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }, []);

  return { submitting, run };
}
