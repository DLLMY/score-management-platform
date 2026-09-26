import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import AnimatedScore from './AnimatedScore';

describe('AnimatedScore', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders provided value immediately on first mount (no animation)', () => {
    const { container } = render(<AnimatedScore value={85} />);
    expect(container.textContent).toContain('85');
    expect((container.firstChild as HTMLElement).className).toContain('text-green-600');
  });

  it('accepts the score prop alias', () => {
    const { container } = render(<AnimatedScore score={88} />);
    expect(container.textContent).toContain('88');
    expect((container.firstChild as HTMLElement).className).toContain('text-green-600');
  });

  it('renders "--" and gray for null/undefined value', () => {
    const { container } = render(<AnimatedScore value={undefined} />);
    expect(container.textContent).toContain('--');
    expect((container.firstChild as HTMLElement).className).toContain('text-gray-400');
  });

  it('color thresholds: >=60 blue, <60 red', () => {
    const { container, rerender } = render(<AnimatedScore value={65} />);
    expect((container.firstChild as HTMLElement).className).toContain('text-blue-600');
    rerender(<AnimatedScore value={50} />);
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect((container.firstChild as HTMLElement).className).toContain('text-red-600');
  });

  it('animates from previous to new value and settles at the new value', () => {
    const { container, rerender } = render(<AnimatedScore value={10} />);
    expect(container.textContent).toContain('10');
    rerender(<AnimatedScore value={90} />);
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(container.textContent).toContain('90');
    expect((container.firstChild as HTMLElement).className).toContain('text-green-600');
  });

  it('switching to null after a value shows "--"', () => {
    const { container, rerender } = render(<AnimatedScore value={80} />);
    rerender(<AnimatedScore value={undefined} />);
    expect(container.textContent).toContain('--');
  });
});
