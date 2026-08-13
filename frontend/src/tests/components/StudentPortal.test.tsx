/**
 * StudentPortal 学生自助中心组件测试
 *
 * 重点：
 *  - 6 个 Tab（积分/通知/请假/手机箱/排名/我的成长）全部渲染
 *  - 默认积分 Tab 显示当前积分（mock 数据）
 *  - 切「我的成长」Tab 渲染参与度/风险/趋势卡片
 *  - 防 TDZ 回归：若 loadInsights 等 hook 定义顺序错位，切 Tab 时渲染会抛错被测试捕获
 *    （历史上 TDZ 白屏 bug 未被 vitest 覆盖，只能靠 Playwright 发现——本测试补上）
 */
/// <reference types="jest" />
import { vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';

import StudentPortal from '../../pages/StudentPortal';
import { mockLocalStorage, renderWithProviders } from '../utils/test-utils';

// module 级 mock：普通函数实现（勿用 jest.fn().mockResolvedValue，避免被 clearAllMocks 清掉）
// 注意：vitest 4 下 jest.mock 兼容层不生效（hoisting 失效），必须用 vi.mock
vi.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    student: {
      getMyRank: () =>
        Promise.resolve({
          class_name: '一年级1班',
          my_rank: 2,
          my_score: 85,
          total_students: 3,
          ranking: [
            { user_id: 1, name: '甲', current_score: 95 },
            { user_id: 2, name: '乙', current_score: 85 },
          ],
        }),
      getScore: () => Promise.resolve({ current_score: 85, name: '乙', card_id: 'CARD001' }),
      getRecords: () =>
        Promise.resolve({
          data: [
            {
              id: 1,
              description: '课堂表现加分',
              score_change: 5,
              created_at: '2026-08-01T10:00:00',
              operator: 'admin',
            },
          ],
          pagination: { page: 1, page_size: 20, total: 1, pages: 1 },
        }),
      getNotifications: () => Promise.resolve({ data: [], pagination: { page: 1, page_size: 20, total: 0, pages: 0 } }),
      getLeaves: () => Promise.resolve([]),
      applyLeave: () => Promise.resolve({}),
      requestPhoneboxUnlock: () => Promise.resolve({ allowed: true, reason: 'ok' }),
      getInsights: () =>
        Promise.resolve({
          student: { id: 2, name: '乙', card_id: 'CARD001' },
          engagement: {
            has_data: true,
            engagement_score: 62.5,
            level: 'medium',
            components: { attendance_rate: 0.9, homework_rate: 0.8, activity_rate: 0.6, leave_days: 0 },
            description: '参与度指数 62.5（中），综合评估。',
          },
          risk: {
            overall_risk_level: 'low',
            overall_risk_score: 0.1,
            intervention_suggestions: ['当前表现正常，继续保持'],
            recommended_actions: [],
          },
          score_trend: [
            { week_index: 1, score_change: 2 },
            { week_index: 2, score_change: 3 },
          ],
          days: 30,
          weeks: 8,
        }),
    },
  },
}));

describe('StudentPortal Component', () => {
  beforeEach(() => {
    const store = mockLocalStorage();
    store['student'] = JSON.stringify({
      id: 2,
      name: '乙',
      card_id: 'CARD001',
      class_name: '一年级1班',
    });
    store['student_token'] = 'fake-student-token';
  });

  test('渲染 6 个 Tab 导航', async () => {
    renderWithProviders(<StudentPortal />);
    await waitFor(() => {
      expect(screen.getByText('学生自助中心')).toBeInTheDocument();
    });
    for (const label of ['积分', '通知', '请假', '手机箱', '排名', '我的成长']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  test('默认积分 Tab 显示当前积分与流水', async () => {
    renderWithProviders(<StudentPortal />);
    await waitFor(() => {
      expect(screen.getByText(/当前积分/i)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('85')).toBeInTheDocument();
      expect(screen.getByText(/课堂表现加分/i)).toBeInTheDocument();
    });
  });

  test('切「我的成长」Tab 渲染参与度/风险/趋势卡片（TDZ 回归防护）', async () => {
    renderWithProviders(<StudentPortal />);
    await waitFor(() => {
      expect(screen.getByText('学生自助中心')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: '我的成长' }));
    await waitFor(() => {
      expect(screen.getByText(/我的参与度指数/i)).toBeInTheDocument();
    });
    // 参与度分数（62.5）渲染
    await waitFor(() => {
      expect(screen.getByText('62.5')).toBeInTheDocument();
    });
    // 风险卡片 + 趋势卡
    await waitFor(() => {
      expect(screen.getByText(/风险预警/i)).toBeInTheDocument();
      expect(screen.getByText(/近 8 周积分变动/i)).toBeInTheDocument();
    });
  });

  test('切「排名」Tab 渲染我的排名', async () => {
    renderWithProviders(<StudentPortal />);
    await waitFor(() => {
      expect(screen.getByText('学生自助中心')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: '排名' }));
    await waitFor(() => {
      expect(screen.getByText(/我的班级排名/i)).toBeInTheDocument();
      expect(screen.getByText('#2')).toBeInTheDocument();
    });
  });
});

export {};
