/**
 * RankBoard 测试 —— 覆盖报告 P0 的 "RankBoard 数值展示"：
 * 班级榜总分/平均分/班级数、学生榜积分与剩余开锁（x/y）格式化。
 * api 全部 mock，避免真实网络与后端契约绑定。
 */
/// <reference types="jest" />
import { screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import React from 'react';
import RankBoard from '../../pages/RankBoard';
import { renderWithProviders } from '../utils/test-utils';

const mockApi = vi.hoisted(() => ({
  rank: {
    getClassRanking: vi.fn(() =>
      Promise.resolve({
        ranking: [
          {
            class_name: '一班',
            student_count: 30,
            total_score: 1200,
            avg_score: 40,
            unlock_count_30d: 5,
          },
        ],
        total_classes: 1,
      })
    ),
    getStudentRanking: vi.fn(() =>
      Promise.resolve({
        ranking: [
          {
            user_id: 1,
            name: '张三',
            class_name: '一班',
            current_score: 88,
            daily_unlock_limit: 3,
            remaining_unlock: 2,
          },
        ],
        total_students: 1,
      })
    ),
  },
  classes: {
    getAll: vi.fn(() => Promise.resolve({ classes: [{ id: 1, name: '一班' }] })),
  },
}));

vi.mock('../../services/api', () => ({ default: mockApi }));

describe('RankBoard numeric display', () => {
  test('class tab shows ranking, total count and avg score', async () => {
    renderWithProviders(<RankBoard />);
    await screen.findByText('一班');
    expect(screen.getByText(/共 1 个班/)).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
  });

  test('student tab shows score and remaining unlock (x/y)', async () => {
    renderWithProviders(<RankBoard />);
    await screen.findByText('一班');
    fireEvent.click(screen.getByText('学生榜'));
    await screen.findByText('张三');
    expect(screen.getByText('共 1 名学生')).toBeInTheDocument();
    expect(screen.getByText('88')).toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument();
  });
});
