/* eslint-disable react-hooks/exhaustive-deps */
/**
 * T12-8 拆分（2026-09-12）：纠正记录域（自学习纠正列表 A 轨条件加载 / 状态更新 / 删除）。
 * 自 useNLPManagementLogic.ts 原样搬出，showToast / confirmRef 由组合根注入。
 */

import { useState, useCallback, useMemo } from 'react';
import type { MutableRefObject } from 'react';
import { useConfirm, type ColumnType } from '../../../components';
import { useListFetch } from '../../../hooks';
import api from '../../../services/api';
import { buildCorrectionColumns } from '../columns';
import type { NLPDeps, NlpCorrection, ShowToast } from '../types';

export interface useNLPCorrectionsParams {
  showToast: ShowToast;
  confirmRef: MutableRefObject<ReturnType<typeof useConfirm>>;
}

export function useNLPCorrections(
  params: useNLPCorrectionsParams
): Pick<
  NLPDeps,
  | 'showCorrectionList'
  | 'setShowCorrectionList'
  | 'setCorrectionsPage'
  | 'fetchCorrections'
  | 'corrections'
  | 'correctionsLoading'
  | 'correctionsPage'
  | 'correctionTotal'
  | 'correctionStatusFilter'
  | 'setCorrectionStatusFilter'
  | 'correctionColumns'
  | 'handleUpdateCorrection'
  | 'handleDeleteCorrection'
> {
  const { showToast, confirmRef } = params;

  // 自学习反馈相关状态
  const [correctionsPage, setCorrectionsPage] = useState(1);
  const [showCorrectionList, setShowCorrectionList] = useState(false);
  const [correctionStatusFilter, setCorrectionStatusFilter] = useState('');

  // 纠正记录列表（A 轨：条件加载 → useListFetch + enabled 跟随 showCorrectionList 按需拉取）
  const correctionsList = useListFetch<NlpCorrection>({
    enabled: showCorrectionList,
    fetcher: async (p) => {
      const response = await api.nlp.getCorrections({
        page: p.page,
        per_page: p.pageSize,
        status: typeof p.status === 'string' && p.status ? p.status : undefined,
      });
      return { items: response?.items ?? [], total: response?.total ?? 0 };
    },
    params: {
      page: correctionsPage,
      pageSize: 20,
      status: correctionStatusFilter || undefined,
    },
  });

  // mutation 后重新拉取（保留 fetchCorrections(page?) 调用点语义；翻页走 setCorrectionsPage 触发 params 变化自动重拉）
  const fetchCorrections = useCallback(
    async (page?: number) => {
      if (typeof page === 'number') {
        setCorrectionsPage(page);
      } else {
        await correctionsList.refetch();
      }
    },
    [correctionsList]
  );

  // 更新纠正状态
  const handleUpdateCorrection = useCallback(
    async (id: number, status: string) => {
      try {
        const response = await api.nlp.updateCorrection(id, { status });
        if (response) {
          showToast('success', '纠正状态已更新');
          fetchCorrections();
        } else {
          showToast('error', '操作失败');
        }
      } catch (error) {
        showToast('error', '更新失败');
      }
    },
    [fetchCorrections, showToast]
  );

  // 删除纠正记录
  const handleDeleteCorrection = useCallback(
    async (id: number) => {
      const ok = await confirmRef.current({
        title: '删除纠正记录',
        message: '确定要删除这条纠正记录吗？',
        confirmText: '删除',
        cancelText: '取消',
        type: 'danger',
      });
      if (!ok) return;
      try {
        const response = await api.nlp.deleteCorrection(id);
        if (response) {
          showToast('success', '删除成功');
          fetchCorrections();
        } else {
          showToast('error', '操作失败');
        }
      } catch (error) {
        showToast('error', '删除失败');
      }
    },
    [fetchCorrections, showToast]
  );

  // —— 纠正记录表格列定义（E6a：抽到 ./nlp-management/columns） ——
  const correctionColumns = useMemo<ColumnType<NlpCorrection>[]>(
    () => buildCorrectionColumns(),
    []
  );

  return {
    showCorrectionList,
    setShowCorrectionList,
    setCorrectionsPage,
    fetchCorrections,
    corrections: correctionsList.items,
    correctionsLoading: correctionsList.loading,
    correctionsPage,
    correctionTotal: correctionsList.total,
    correctionStatusFilter,
    setCorrectionStatusFilter,
    correctionColumns,
    handleUpdateCorrection,
    handleDeleteCorrection,
  };
}
