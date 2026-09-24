import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from '../useMediaQuery';
import { useIsMobile } from '../useIsMobile';

type Mql = {
  matches: boolean;
  media: string;
  onchange: null;
  addListener: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  dispatchEvent: ReturnType<typeof vi.fn>;
};

// 收集每次 matchMedia 调用返回的实例（hook 会多次调用，每次都是新对象）
function mockMatchMedia(matches: boolean): Mql[] {
  const created: Mql[] = [];
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    const inst: Mql = {
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    created.push(inst);
    return inst;
  });
  return created;
}

describe('useMediaQuery · 响应式媒体查询', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('无 matchMedia 时安全返回 false', () => {
    const original = window.matchMedia;
    // @ts-expect-error 测试缺失场景
    window.matchMedia = undefined;
    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'));
    expect(result.current).toBe(false);
    window.matchMedia = original;
  });

  it('matches=true → 返回 true，并注册 change 监听', () => {
    const created = mockMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'));
    expect(result.current).toBe(true);
    const mql = created[created.length - 1]; // useEffect 中创建的实例
    expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('matches=false → 返回 false', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(false);
  });

  it('媒体查询变化 → 触发重渲染更新 matches', () => {
    const created = mockMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'));
    expect(result.current).toBe(true);
    const mql = created[created.length - 1];
    const handler = mql.addEventListener.mock.calls[0][1] as (e: { matches: boolean }) => void;
    act(() => {
      handler({ matches: false });
    });
    expect(result.current).toBe(false);
  });
});

describe('useIsMobile · 移动端视口 (<768px)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('视口匹配移动断点 → true', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('视口不匹配 → false', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});
