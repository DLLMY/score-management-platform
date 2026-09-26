import { describe, it, expect, vi, beforeEach } from 'vitest';
import { preloadService, type PreloadConfig, type PreloadStats } from '../preloadService';

/** 构造一个带可选 preload 的伪组件 */
const makeComponent = (preloadImpl?: () => Promise<unknown>) => {
  const comp: any = () => null;
  if (preloadImpl) comp.preload = preloadImpl;
  return comp as PreloadConfig['component'];
};

const baseConfig = (over: Partial<PreloadConfig> = {}): PreloadConfig => ({
  route: '/r',
  component: makeComponent(),
  priority: 'medium',
  ...over,
});

describe('PreloadService', () => {
  const service = preloadService;

  beforeEach(() => {
    // 重置单例内部状态，保证用例隔离（类未导出，使用导出的单例 + 私有 map 清空）
    (service as unknown as { preloadMap: Map<string, unknown> }).preloadMap.clear();
    (service as unknown as { loadingPromises: Map<string, unknown> }).loadingPromises.clear();
    service.setEnabled(true);
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('register：新路由注册成功；重复路由被忽略', () => {
    service.register(baseConfig());
    expect(service.getStats('/r')).toBeDefined();
    const before = service.getStats('/r') as PreloadStats;
    service.register(baseConfig());
    const after = service.getStats('/r') as PreloadStats;
    expect(after).toBe(before);
  });

  it('register：preloadOnVisit 且已有访问记录时立即预加载', () => {
    localStorage.setItem('route_visits', JSON.stringify({ '/r': 5 }));
    const preload = vi.fn().mockResolvedValue(() => null);
    service.register(baseConfig({ preloadOnVisit: true, component: makeComponent(preload) }));
    expect(preload).toHaveBeenCalledTimes(1);
  });

  it('preload：禁用时返回 null', () => {
    service.setEnabled(false);
    service.register(
      baseConfig({ component: makeComponent(vi.fn().mockResolvedValue(() => null)) })
    );
    expect(service.preload('/r')).toBeNull();
  });

  it('preload：未注册路由返回 null', () => {
    expect(service.preload('/unknown')).toBeNull();
  });

  it('preload：无 preload 函数返回 null', () => {
    service.register(baseConfig());
    expect(service.preload('/r')).toBeNull();
  });

  it('preload：成功路径设置 loaded 与 loadTime 并清除 loadingPromise', async () => {
    const preload = vi.fn().mockResolvedValue(() => null);
    service.register(baseConfig({ component: makeComponent(preload) }));
    await service.preload('/r');
    const stats = service.getStats('/r') as PreloadStats;
    expect(stats.loaded).toBe(true);
    expect(stats.loadTime).toBeGreaterThanOrEqual(0);
    const again = await service.preload('/r');
    expect(again).toBeNull();
  });

  it('preload：进行中返回同一 Promise（loadingPromises 复用）', () => {
    const preload = vi.fn().mockReturnValue(new Promise(() => {}));
    service.register(baseConfig({ component: makeComponent(preload) }));
    const p1 = service.preload('/r');
    const p2 = service.preload('/r');
    expect(p1).toBe(p2);
    expect(p1).not.toBeNull();
  });

  it('preload：preload 失败时 catch 清除 loadingPromise 且不抛错', async () => {
    const preload = vi.fn().mockRejectedValue(new Error('boom'));
    service.register(baseConfig({ component: makeComponent(preload) }));
    await expect(service.preload('/r')).resolves.toBeUndefined();
    preload.mockResolvedValue(() => null);
    await service.preload('/r');
    expect((service.getStats('/r') as PreloadStats).loaded).toBe(true);
  });

  it('preloadOnHover：无条目或flag未开启时为 no-op；开启时触发 preload', () => {
    const preload = vi.fn().mockResolvedValue(() => null);
    service.preloadOnHover('/r'); // 无条目
    service.register(baseConfig({ route: '/r', component: makeComponent(preload) }));
    service.preloadOnHover('/r'); // 未开启 preloadOnHover
    expect(preload).not.toHaveBeenCalled();
    service.register(
      baseConfig({ route: '/r2', preloadOnHover: true, component: makeComponent(preload) })
    );
    service.preloadOnHover('/r2');
    expect(preload).toHaveBeenCalled();
  });

  it('recordVisit：无条目 no-op；有条目则累加访问、写 localStorage、触发 preloadOnVisit', () => {
    service.recordVisit('/r');
    const preload = vi.fn().mockResolvedValue(() => null);
    service.register(baseConfig({ preloadOnVisit: true, component: makeComponent(preload) }));
    service.recordVisit('/r');
    const stats = service.getStats('/r') as PreloadStats;
    expect(stats.visitCount).toBe(1);
    expect(stats.lastVisitTime).not.toBeNull();
    expect(JSON.parse(localStorage.getItem('route_visits') || '{}')['/r']).toBe(1);
    expect(preload).toHaveBeenCalledTimes(1);
  });

  it('preloadPriorityRoutes：禁用时直接返回；否则按 high 优先级顺序预加载', async () => {
    const highPreload = vi.fn().mockResolvedValue(() => null);
    const lowPreload = vi.fn().mockResolvedValue(() => null);
    service.setEnabled(false);
    service.register(
      baseConfig({ route: '/high', priority: 'high', component: makeComponent(highPreload) })
    );
    await service.preloadPriorityRoutes();
    expect(highPreload).not.toHaveBeenCalled();
    service.setEnabled(true);
    service.register(
      baseConfig({ route: '/low', priority: 'low', component: makeComponent(lowPreload) })
    );
    await service.preloadPriorityRoutes();
    expect(highPreload).toHaveBeenCalledTimes(1);
    expect(lowPreload).not.toHaveBeenCalled();
  });

  it('preloadDependencies：无条目/无 deps 时 no-op；有 deps 时逐个预加载依赖路由', () => {
    service.preloadDependencies('/r'); // 无条目 no-op
    const aPreload = vi.fn().mockResolvedValue(() => null);
    const bPreload = vi.fn().mockResolvedValue(() => null);
    service.register(baseConfig({ route: '/a', component: makeComponent(aPreload) }));
    service.register(baseConfig({ route: '/b', component: makeComponent(bPreload) }));
    service.register(
      baseConfig({ route: '/r2', component: makeComponent(), dependencies: ['/a', '/b'] })
    );
    service.preloadDependencies('/r2'); // 预加载 /a 与 /b
    expect(aPreload).toHaveBeenCalled();
    expect(bPreload).toHaveBeenCalled();
    service.register(baseConfig({ route: '/nodeps' })); // 无 deps 路由
    service.preloadDependencies('/nodeps'); // no-op，不抛错
  });

  it('getStats：按路由返回 stats 或空统计；无参返回全部数组', () => {
    service.register(baseConfig());
    const single = service.getStats('/r') as PreloadStats;
    expect(single.route).toBe('/r');
    const empty = service.getStats('/missing') as PreloadStats;
    expect(empty.loaded).toBe(false);
    expect(Array.isArray(service.getStats())).toBe(true);
  });

  it('setEnabled/isEnabled 与 clearCache', async () => {
    service.setEnabled(false);
    expect(service.isEnabled()).toBe(false);
    service.setEnabled(true);
    expect(service.isEnabled()).toBe(true);
    const preload = vi.fn().mockResolvedValue(() => null);
    service.register(baseConfig({ component: makeComponent(preload) }));
    await service.preload('/r');
    service.clearCache();
    const stats = service.getStats('/r') as PreloadStats;
    expect(stats.loaded).toBe(false);
    expect(stats.loadTime).toBe(0);
  });
});
