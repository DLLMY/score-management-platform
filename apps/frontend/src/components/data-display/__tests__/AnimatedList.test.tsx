import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useState } from 'react';
import AnimatedList from '../AnimatedList';

interface Row {
  id: number;
  name: string;
}

function Item({
  items,
  onItemAppear,
}: {
  items: Row[];
  onItemAppear?: (key: string | number) => void;
}) {
  return (
    <AnimatedList
      items={items}
      keyExtractor={(i) => (i as unknown as Row).id}
      renderItem={(i) => <span>{(i as unknown as Row).name}</span>}
      onItemAppear={onItemAppear}
    />
  );
}

describe('AnimatedList', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('渲染所有 items', () => {
    const { container } = render(
      <Item
        items={[
          { id: 1, name: 'A' },
          { id: 2, name: 'B' },
        ]}
      />
    );
    expect(container.textContent).toContain('A');
    expect(container.textContent).toContain('B');
  });

  it('新 item 标记 _isNew → animate-slide-up 且 animationDelay 按 index*50ms', () => {
    const { container } = render(
      <Item
        items={[
          { id: 1, name: 'A' },
          { id: 2, name: 'B' },
        ]}
      />
    );
    const wrappers = Array.from(
      container.querySelectorAll('div.space-y-1 > div')
    ) as HTMLDivElement[];
    expect(wrappers).toHaveLength(2);
    expect(wrappers[0].className).toContain('animate-slide-up');
    expect(wrappers[1].className).toContain('animate-slide-up');
    expect(wrappers[0].style.animationDelay).toBe('0ms');
    expect(wrappers[1].style.animationDelay).toBe('50ms');
  });

  it('onItemAppear 在 setTimeout(100) 后被调用，参数为新增 key', () => {
    const onItemAppear = vi.fn();
    render(
      <Item
        items={[
          { id: 1, name: 'A' },
          { id: 2, name: 'B' },
        ]}
        onItemAppear={onItemAppear}
      />
    );
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(onItemAppear).toHaveBeenCalledTimes(2);
    expect(onItemAppear).toHaveBeenCalledWith(1);
    expect(onItemAppear).toHaveBeenCalledWith(2);
  });

  it('移除 item → 计算 removedKeys（_isLeaving 分支被执行）', () => {
    function Controller() {
      const [items, setItems] = useState<Row[]>([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ]);
      return (
        <div>
          <button data-testid='remove' onClick={() => setItems([{ id: 1, name: 'A' }])}>
            remove
          </button>
          <AnimatedList
            items={items}
            keyExtractor={(i) => (i as unknown as Row).id}
            renderItem={(i) => <span>{(i as unknown as Row).name}</span>}
          />
        </div>
      );
    }
    const { container } = render(<Controller />);
    // 初次渲染：两个 item 均为 _isNew
    expect(container.querySelectorAll('div.space-y-1 > div')).toHaveLength(2);
    act(() => {
      container
        .querySelector('[data-testid="remove"]')
        ?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    // 重新渲染后仅剩 A（B 被移除，removedKeys 被计算但不出现在可见列表）
    expect(container.textContent).toContain('A');
    expect(container.textContent).not.toContain('B');
  });
});
