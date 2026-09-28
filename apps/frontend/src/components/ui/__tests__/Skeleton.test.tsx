/**
 * Skeleton 补测（B35）。纯展示组件，零网络依赖。
 * 覆盖基础变体（variant/animation/width/height）与复合骨架
 * （TableSkeleton/CardSkeleton/FormSkeleton/CategoryCardSkeleton/DashboardSkeleton）
 * 的条件渲染分支（showHeader/showAvatar/showSubtitle/showActions/showCharts/count）。
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Skeleton,
  TableSkeleton,
  CardSkeleton,
  FormSkeleton,
  CategoryCardSkeleton,
  DashboardSkeleton,
} from '../Skeleton';

describe('Skeleton · 基础变体', () => {
  it('默认 rectangular + pulse', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('rounded-md');
    expect(el.className).toContain('animate-pulse');
  });

  it('variant=text/circular + animation=wave/none', () => {
    const { container, rerender } = render(<Skeleton variant='text' animation='wave' />);
    let el = container.firstChild as HTMLElement;
    expect(el.className).toContain('rounded');
    expect(el.className).toContain('animate-shimmer');
    rerender(<Skeleton variant='circular' animation='none' />);
    el = container.firstChild as HTMLElement;
    expect(el.className).toContain('rounded-full');
    expect(el.className).not.toContain('animate-');
  });

  it('width/height 数字 → px 内联样式', () => {
    const { container } = render(<Skeleton width={120} height={40} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('120px');
    expect(el.style.height).toBe('40px');
  });

  it('width/height 字符串 → 原样内联样式', () => {
    const { container } = render(<Skeleton width='70%' height='20px' />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('70%');
    expect(el.style.height).toBe('20px');
  });
});

describe('Skeleton · 复合骨架', () => {
  it('TableSkeleton showHeader=false → 无 header（border-b 缺失分支）', () => {
    const { container } = render(<TableSkeleton showHeader={false} />);
    expect(container.querySelector('.border-b')).toBeNull();
  });

  it('TableSkeleton 默认 → 渲染 rows×columns 个 cell（含 header）', () => {
    const { container } = render(<TableSkeleton rows={2} columns={3} />);
    expect(container.querySelectorAll('.flex-1').length).toBe(2 * 3 + 3);
  });

  it('CardSkeleton showAvatar=false → 无圆形头像（rounded-full 缺失分支）', () => {
    const { container } = render(
      <CardSkeleton count={1} showAvatar={false} showSubtitle={false} />
    );
    expect(container.querySelector('.rounded-full')).toBeNull();
  });

  it('FormSkeleton showActions=false → 无操作区（flex gap-3 缺失分支）', () => {
    const { container } = render(<FormSkeleton showActions={false} />);
    expect(container.querySelector('.flex.gap-3')).toBeNull();
  });

  it('CategoryCardSkeleton → 渲染 grid 容器', () => {
    const { container } = render(<CategoryCardSkeleton count={1} />);
    expect(container.querySelector('.grid')).toBeTruthy();
  });

  it('DashboardSkeleton showCharts=false → 无图表区（h-[300px] 缺失分支）', () => {
    const { container } = render(<DashboardSkeleton showCharts={false} />);
    const hasChart = Array.from(container.querySelectorAll('div')).some((d) =>
      d.className.includes('h-[300px]')
    );
    expect(hasChart).toBe(false);
  });
});
