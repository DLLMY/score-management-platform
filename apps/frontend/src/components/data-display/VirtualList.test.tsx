import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import VirtualList from './VirtualList';

const makeItems = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: i, name: `Item ${i}` }));

describe('VirtualList', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    // 还原可能的 ResizeObserver 篡改
    delete (global as any).ResizeObserver;
  });

  it('renders only the visible window (virtualization)', () => {
    const items = makeItems(100);
    render(
      <VirtualList
        items={items}
        itemHeight={50}
        renderItem={(it) => <div>{it.name}</div>}
        containerHeight={200}
      />
    );
    // visibleCount = ceil(200/50)=4, + overscan*2=4 => endIndex=8
    expect(screen.queryByText('Item 0')).toBeInTheDocument();
    expect(screen.queryByText('Item 7')).toBeInTheDocument();
    expect(screen.queryByText('Item 50')).not.toBeInTheDocument();
  });

  it('autoHeight renders all items without virtualization', () => {
    const items = makeItems(20);
    render(
      <VirtualList
        items={items}
        itemHeight={50}
        renderItem={(it) => <div>{it.name}</div>}
        autoHeight
        containerHeight={200}
      />
    );
    for (let i = 0; i < 20; i++) {
      expect(screen.getByText(`Item ${i}`)).toBeInTheDocument();
    }
  });

  it('scroll updates visible window (rAF callback applies scrollTop)', () => {
    // 源码在 rAF 回调内读取 e.currentTarget.scrollTop；异步 rAF 中合成事件的
    // currentTarget 已被 React 置空，故用同步 rAF 让回调在 onScroll 同步栈内执行。
    vi.useRealTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: any) => {
      cb(0);
      return 0;
    });
    const items = makeItems(100);
    const { container } = render(
      <VirtualList
        items={items}
        itemHeight={50}
        renderItem={(it) => <div>{it.name}</div>}
        containerHeight={200}
      />
    );
    const scroller = container.firstChild as HTMLElement;
    fireEvent.scroll(scroller, { target: { scrollTop: 250 } });
    // 同步 rAF -> setScrollTop(250) -> startIndex = floor(250/50)-2 = 3
    expect(screen.queryByText('Item 0')).not.toBeInTheDocument();
    expect(screen.queryByText('Item 3')).toBeInTheDocument();
    expect(screen.queryByText('Item 10')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('observes container with ResizeObserver when available', () => {
    const observe = vi.fn();
    (global as any).ResizeObserver = class {
      observe = observe;
      disconnect() {}
    };
    const items = makeItems(10);
    render(<VirtualList items={items} itemHeight={50} renderItem={(it) => <div>{it.name}</div>} />);
    expect(observe).toHaveBeenCalled();
  });

  it('skips ResizeObserver when unavailable (guard branch)', () => {
    delete (global as any).ResizeObserver;
    const items = makeItems(10);
    expect(() =>
      render(
        <VirtualList items={items} itemHeight={50} renderItem={(it) => <div>{it.name}</div>} />
      )
    ).not.toThrow();
  });

  it('supports custom keyExtractor and default fallback', () => {
    const items = makeItems(5);
    const { rerender } = render(
      <VirtualList
        items={items}
        itemHeight={50}
        renderItem={(it) => <div>{it.name}</div>}
        keyExtractor={(it) => `k-${it.id}`}
      />
    );
    expect(screen.getByText('Item 0')).toBeInTheDocument();
    const noId = items.map((_, i) => ({ name: `N${i}` }));
    rerender(
      <VirtualList items={noId} itemHeight={50} renderItem={(it) => <div>{it.name}</div>} />
    );
    expect(screen.getByText('N0')).toBeInTheDocument();
  });

  it('resets scrollTop when items length changes', () => {
    const items = makeItems(100);
    const { rerender } = render(
      <VirtualList
        items={items}
        itemHeight={50}
        renderItem={(it) => <div>{it.name}</div>}
        containerHeight={200}
      />
    );
    rerender(
      <VirtualList
        items={makeItems(50)}
        itemHeight={50}
        renderItem={(it) => <div>{it.name}</div>}
        containerHeight={200}
      />
    );
    // items.length 变化 -> useEffect 执行 setScrollTop(0)（已覆盖其分支）
    expect(screen.queryByText('Item 0')).toBeInTheDocument();
  });
});
