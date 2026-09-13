/**
 * T12-8 拆分（2026-09-12）：统计分析域（统计数据拉取）。
 * 自 useNLPManagementLogic.ts 原样搬出，showToast 由组合根注入。
 */

import { useCallback, useState } from 'react';
import api from '../../../services/api';
import type { NLPDeps, ShowToast, Statistics } from '../types';

export interface useNLPStatisticsParams {
  showToast: ShowToast;
}

export function useNLPStatistics(
  params: useNLPStatisticsParams
): Pick<NLPDeps, 'statistics' | 'setStatistics' | 'fetchStatistics'> {
  const { showToast } = params;

  const [statistics, setStatistics] = useState<Statistics | null>(null);

  const fetchStatistics = useCallback(async () => {
    try {
      const response = await api.nlp.getRuleStatistics();
      if (response) {
        setStatistics(response as unknown as Statistics);
      }
    } catch (error) {
      showToast('error', '获取统计数据失败');
    }
  }, [showToast]);

  return { statistics, setStatistics, fetchStatistics };
}
