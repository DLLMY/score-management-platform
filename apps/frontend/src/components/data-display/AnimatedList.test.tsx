import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import AnimatedList from './AnimatedList';

interface Row {
  id: number;
  label: string;
}

// AnimatedList 经 memo 包裹导出，泛型参数在类型层面丢失；测试中用类型断言恢复泛型签名
const Cmp = AnimatedList as unknown as <T>(props: {
  items: T[];
  keyExtractor: (item: T) => string | number;
  renderItem: (
    item: T & { _animationKey: string | number; _isNew: boolean; _isLeaving: boolean }
  ) => ReactNode;
  onItemAppear?: (key: string | number) => void;
}) => JSX.Element;

function Harness({ items, onAppear }: { items: Row[]; onAppear?: (k: number | string) => void }) {
  return (
    <Cmp
      items={items}
      keyExtractor={(i) => i.id}
      onItemAppear={onAppear}
      renderItem={(i) => <div>{i.label}</div>}
    />
  );
}

describe('AnimatedList', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders items through renderItem', () => {
    const { container } = render(
      <Harness
        items={[
          { id: 1, label: 'A' },
          { id: 2, label: 'B' },
        ]}
      />
    );
    expect(container.textContent).toContain('A');
    expect(container.textContent).toContain('B');
  });

  it('invokes onItemAppear for initial keys on mount and new keys on update', () => {
    const onAppear = vi.fn();
    const { rerender } = render(<Harness items={[{ id: 1, label: 'A' }]} onAppear={onAppear} />);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(onAppear).toHaveBeenCalledTimes(1);
    expect(onAppear).toHaveBeenCalledWith(1);

    rerender(
      <Harness
        items={[
          { id: 1, label: 'A' },
          { id: 2, label: 'B' },
        ]}
        onAppear={onAppear}
      />
    );
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(onAppear).toHaveBeenCalledTimes(2);
    expect(onAppear).toHaveBeenCalledWith(2);
  });

  it('does not re-invoke onItemAppear for keys already present', () => {
    const onAppear = vi.fn();
    const { rerender } = render(<Harness items={[{ id: 1, label: 'A' }]} onAppear={onAppear} />);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(onAppear).toHaveBeenCalledTimes(1);

    rerender(<Harness items={[{ id: 1, label: 'A' }]} onAppear={onAppear} />);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(onAppear).toHaveBeenCalledTimes(1);
  });

  it('marks first-appearance items with animate-slide-up', () => {
    const { container } = render(<Harness items={[{ id: 1, label: 'A' }]} />);
    expect(container.querySelectorAll('[class*="animate-slide-up"]').length).toBe(1);
  });

  it('removes items no longer present and does not mark them leaving', () => {
    const { rerender, container } = render(
      <Harness
        items={[
          { id: 1, label: 'A' },
          { id: 2, label: 'B' },
        ]}
      />
    );
    rerender(<Harness items={[{ id: 1, label: 'A' }]} />);
    expect(container.textContent).not.toContain('B');
    expect(container.querySelectorAll('[class*="animate-slide"]').length).toBe(0);
  });

  it('empty items render no children', () => {
    const { container } = render(<Harness items={[]} />);
    expect(container.children[0].children.length).toBe(0);
  });
});
