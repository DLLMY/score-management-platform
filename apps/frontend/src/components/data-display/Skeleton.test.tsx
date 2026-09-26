import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton, SkeletonText, SkeletonAvatar, SkeletonCard, SkeletonList } from './Skeleton';

describe('data-display Skeleton', () => {
  it('SkeletonText renders N rows with decreasing width', () => {
    const { container } = render(<SkeletonText rows={3} />);
    const rows = container.querySelectorAll('.animate-pulse');
    expect(rows.length).toBe(3);
    expect(rows[0].getAttribute('style')).toContain('width: 80%');
    expect(rows[2].getAttribute('style')).toContain('width: 60%');
  });

  it('SkeletonText defaults to 1 row', () => {
    const { container } = render(<SkeletonText />);
    expect(container.querySelectorAll('.animate-pulse').length).toBe(1);
  });

  it('SkeletonAvatar size variants', () => {
    const { container: sm } = render(<SkeletonAvatar size='sm' />);
    expect((sm.firstChild as HTMLElement).className).toContain('w-8');
    const { container: lg } = render(<SkeletonAvatar size='lg' />);
    expect((lg.firstChild as HTMLElement).className).toContain('w-16');
  });

  it('SkeletonCard composes avatar + text + skeleton', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(3);
  });

  it('SkeletonList renders count cards', () => {
    const { container } = render(<SkeletonList count={4} />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(4 * 3);
  });

  it('default Skeleton renders a pulse block', () => {
    const { container } = render(<Skeleton className='h-4' />);
    expect((container.firstChild as HTMLElement).className).toContain('animate-pulse');
  });
});
