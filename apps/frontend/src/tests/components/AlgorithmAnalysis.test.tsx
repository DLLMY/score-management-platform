/**
 * AlgorithmAnalysis 算法分析页组件测试
 *
 * 重点：
 *  - 11 个 Tab（统计分析~参与度分析）全部渲染
 *  - 默认「统计分析」Tab 内容渲染（空态兜底）
 *  - 切「班级归因」Tab → 内嵌班级下拉框与生成按钮存在
 *  - 防崩溃回归：页面依赖 30+ api.algorithm 方法与 useSearchParams，
 *    任何 hook 定义顺序错位（TDZ 类）或 mock 缺失都会在此渲染层暴露
 */
/// <reference types="jest" />
import { vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';

import AlgorithmAnalysis from '../../pages/AlgorithmAnalysis';
import { mockLocalStorage, renderWithProviders } from '../utils/test-utils';

// module 级 mock：所有 api 方法返回普通函数实现，避免被 clearAllMocks 清掉
// 注意：vitest 4 下 jest.mock 兼容层不生效（hoisting 失效），必须用 vi.mock
vi.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    classes: { getAll: () => Promise.resolve([]) },
    users: { getAll: () => Promise.resolve([]) },
    algorithm: {
      getStatistics: () => Promise.resolve(null),
      getClusters: () => Promise.resolve(null),
      getWarnings: () => Promise.resolve(null),
      getPrediction: () => Promise.resolve(null),
      getBatchPrediction: () => Promise.resolve(null),
      getRiskStudents: () => Promise.resolve([]),
      getSuddenChange: () => Promise.resolve(null),
      getTrendAnomaly: () => Promise.resolve(null),
      getGroupAnomaly: () => Promise.resolve(null),
      getUserAnomaly: () => Promise.resolve(null),
      getBatchAnomaly: () => Promise.resolve(null),
      getRuleRecommend: () => Promise.resolve(null),
      getScorePredict: () => Promise.resolve(null),
      getBatchScorePredict: () => Promise.resolve(null),
      getRiskPredict: () => Promise.resolve(null),
      getBatchRiskPredict: () => Promise.resolve(null),
      getScoreAttribution: () => Promise.resolve(null),
      getBatchAttribution: () => Promise.resolve(null),
      getEngagement: () => Promise.resolve(null),
      getEngagementRank: () => Promise.resolve(null),
      getEngagementTrend: () => Promise.resolve(null),
      getScoreDistributionStats: () => Promise.resolve(null),
      getEarningRules: () => Promise.resolve([]),
      getSpendingRules: () => Promise.resolve([]),
      getRewardTypes: () => Promise.resolve([]),
      adjustScoreDistribution: () => Promise.resolve(null),
      applyRuleByBehavior: () => Promise.resolve(null),
      trainRuleRecommendModel: () => Promise.resolve(null),
      trainScorePredictModel: () => Promise.resolve(null),
      trainRiskPredictModel: () => Promise.resolve(null),
      evaluateRuleRecommendModel: () => Promise.resolve(null),
      evaluateScorePredictModel: () => Promise.resolve(null),
      evaluateRiskPredictModel: () => Promise.resolve(null),
      exportExcel: () => Promise.resolve(undefined),
    },
  },
}));

const TABS = [
  '统计分析',
  '积分预测',
  '异常检测',
  '规则推荐',
  '成绩预测',
  '风险评估',
  '模型管理',
  '智能规则应用',
  '学生画像',
  '班级归因',
  '参与度分析',
];

describe('AlgorithmAnalysis Component', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  test('渲染 11 个 Tab 导航', async () => {
    renderWithProviders(<AlgorithmAnalysis />);
    await waitFor(() => {
      // 页面标题（统计分析为默认 Tab，其空态文案会出现）
      expect(document.body.textContent || '').toContain('统计分析');
    });
    for (const label of TABS) {
      const btn = screen.queryByRole('button', { name: new RegExp(label) });
      expect(btn).toBeTruthy();
    }
  });

  test('默认统计分析 Tab 渲染（空态兜底不崩溃）', async () => {
    renderWithProviders(<AlgorithmAnalysis />);
    await waitFor(() => {
      expect(document.body.textContent || '').toContain('统计分析');
    });
  });

  test('切「班级归因」Tab 渲染内嵌班级下拉框与生成按钮', async () => {
    renderWithProviders(<AlgorithmAnalysis />);
    await waitFor(() => {
      expect(document.body.textContent || '').toContain('统计分析');
    });
    fireEvent.click(screen.getByRole('button', { name: /班级归因/ }));
    await waitFor(() => {
      // 「选择班级」label 与空态引导文案均含该词，用 getAllByText 断言存在
      expect(screen.getAllByText(/选择班级/i).length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /生成全班成绩波动归因/ })).toBeInTheDocument();
    });
  });

  test('切「参与度分析」Tab 渲染控制区', async () => {
    renderWithProviders(<AlgorithmAnalysis />);
    await waitFor(() => {
      expect(document.body.textContent || '').toContain('统计分析');
    });
    fireEvent.click(screen.getByRole('button', { name: /参与度分析/ }));
    await waitFor(() => {
      expect(screen.getByText(/统计天数/i)).toBeInTheDocument();
    });
  });
});

export {};
