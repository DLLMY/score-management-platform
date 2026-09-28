/**
 * UserCard 补测（B34）。
 * 纯展示 memo 组件，props 驱动（user / globalIndex / clusters），零网络依赖。
 * 覆盖：top-three 徽标（Crown/Award/Star）与名次徽章（🥇🥈🥉/数字）、
 * current_score 0 兜底、class_name 兜底、clusters 命中/未命中（cluster 标签渲染）、
 * hover 切换、score 多档（getScoreColor 分支）。
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UserCard } from '../UserCard';
import type { User } from '../../../../types';

const baseUser = (over: Record<string, unknown> = {}): User =>
  ({ id: 1, name: '张三', current_score: 95, class_name: '一班', ...over } as unknown as User);

describe('UserCard · top-three 徽标与名次', () => {
  it('globalIndex=0 → 🥇 且展示用户姓名', () => {
    render(<UserCard user={baseUser()} globalIndex={0} clusters={null} />);
    expect(screen.getByText('🥇')).toBeInTheDocument();
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.queryByText('6')).toBeNull();
  });

  it('globalIndex=1 → 🥈', () => {
    render(<UserCard user={baseUser()} globalIndex={1} clusters={null} />);
    expect(screen.getByText('🥈')).toBeInTheDocument();
  });

  it('globalIndex=2 → 🥉', () => {
    render(<UserCard user={baseUser()} globalIndex={2} clusters={null} />);
    expect(screen.getByText('🥉')).toBeInTheDocument();
  });

  it('globalIndex>=3 → 显示数字名次且无 top-three 徽标 emoji', () => {
    render(<UserCard user={baseUser({ id: 9 })} globalIndex={5} clusters={null} />);
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.queryByText('🥇')).toBeNull();
    expect(screen.queryByText('🥈')).toBeNull();
    expect(screen.queryByText('🥉')).toBeNull();
  });
});

describe('UserCard · 分值与兜底', () => {
  it('current_score=0 → 显示 0（score 兜底分支）', () => {
    render(<UserCard user={baseUser({ current_score: 0 })} globalIndex={5} clusters={null} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('class_name 缺失 → 显示 "未分班"', () => {
    render(<UserCard user={baseUser({ class_name: undefined })} globalIndex={5} clusters={null} />);
    expect(screen.getByText('未分班')).toBeInTheDocument();
  });

  it('class_name 存在 → 显示班级名', () => {
    render(<UserCard user={baseUser({ class_name: '二班' })} globalIndex={5} clusters={null} />);
    expect(screen.getByText('二班')).toBeInTheDocument();
  });

  it('score 多档覆盖 getScoreColor（>=90 绿 / >=60 蓝 / >=30 黄 / else 红）', () => {
    const { rerender } = render(
      <UserCard user={baseUser({ current_score: 95 })} globalIndex={5} clusters={null} />
    );
    expect(screen.getByText('95')).toBeInTheDocument();
    rerender(<UserCard user={baseUser({ current_score: 70 })} globalIndex={5} clusters={null} />);
    expect(screen.getByText('70')).toBeInTheDocument();
    rerender(<UserCard user={baseUser({ current_score: 40 })} globalIndex={5} clusters={null} />);
    expect(screen.getByText('40')).toBeInTheDocument();
    rerender(<UserCard user={baseUser({ current_score: 5 })} globalIndex={5} clusters={null} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});

describe('UserCard · clusters 命中', () => {
  const clusters = { students: [{ user_id: 1, cluster_name: '全面优秀型' }] };

  it('clusters 命中 user → 渲染 cluster 标签', () => {
    render(<UserCard user={baseUser({ id: 1 })} globalIndex={5} clusters={clusters as never} />);
    expect(screen.getByText('全面优秀型')).toBeInTheDocument();
  });

  it('clusters 为 null → 不渲染 cluster 标签', () => {
    render(<UserCard user={baseUser({ id: 1 })} globalIndex={5} clusters={null} />);
    expect(screen.queryByText('全面优秀型')).toBeNull();
  });
});

describe('UserCard · 交互', () => {
  it('mouseEnter / mouseLeave → hover 状态切换不报错', () => {
    const { container } = render(<UserCard user={baseUser()} globalIndex={0} clusters={null} />);
    const card = container.firstChild as HTMLElement;
    fireEvent.mouseEnter(card);
    fireEvent.mouseLeave(card);
    expect(screen.getByText('张三')).toBeInTheDocument();
  });
});
