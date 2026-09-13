/**
 * T12-7 拆分（2026-09-12）：批量提交进度域（进度条状态 / 分批并发执行器 / 取消）。
 * 自 useScoreEntryLogic.tsx 原样搬出，仅 onCancelBatch 由内联箭头改为 useCallback（引用更稳，行为等价）。
 */

import { useState, useRef, useCallback, type Dispatch, type SetStateAction } from 'react';
import type { BatchFailure } from '../types';

interface BatchProgress {
  processed: number;
  total: number;
}

export interface ScoreEntryBatchResult {
  batchProgress: BatchProgress | null;
  setBatchProgress: Dispatch<SetStateAction<BatchProgress | null>>;
  batchFailures: BatchFailure[] | null;
  setBatchFailures: Dispatch<SetStateAction<BatchFailure[] | null>>;
  runBatched: <T>(
    items: T[],
    fn: (item: T) => Promise<void>,
    onBatchDone?: () => void
  ) => Promise<{ success: number; failed: Array<{ item: T; error: string }> }>;
  onCancelBatch: () => void;
}

export function useScoreEntryBatch(): ScoreEntryBatchResult {
  // 批量提交进度（真实进度 + 可取消）
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  // 保存失败详情条（前 5 条，可关闭）
  const [batchFailures, setBatchFailures] = useState<BatchFailure[] | null>(null);
  const cancelBatchRef = useRef(false);

  // 分批并发提交通用逻辑：每批 20 条并发，逐批推进进度，支持中途取消
  const runBatched = async <T>(
    items: T[],
    fn: (item: T) => Promise<void>,
    onBatchDone?: () => void
  ): Promise<{ success: number; failed: Array<{ item: T; error: string }> }> => {
    const total = items.length;
    const failed: Array<{ item: T; error: string }> = [];
    let success = 0;
    setBatchProgress({ processed: 0, total });
    cancelBatchRef.current = false;
    const BATCH = 20;
    for (let i = 0; i < total; i += BATCH) {
      if (cancelBatchRef.current) break;
      const chunk = items.slice(i, i + BATCH);
      const results = await Promise.allSettled(chunk.map((item) => fn(item)));
      for (let idx = 0; idx < results.length; idx++) {
        const r = results[idx];
        if (r.status === 'fulfilled') success++;
        else failed.push({ item: chunk[idx], error: (r.reason as Error)?.message ?? '未知错误' });
      }
      setBatchProgress({ processed: Math.min(i + BATCH, total), total });
      onBatchDone?.();
    }
    return { success, failed };
  };

  const onCancelBatch = useCallback((): void => {
    cancelBatchRef.current = true;
  }, []);

  return {
    batchProgress,
    setBatchProgress,
    batchFailures,
    setBatchFailures,
    runBatched,
    onCancelBatch,
  };
}
